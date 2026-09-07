import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.payment import SupplierPayment
from app.models.audit import AuditLog
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseItemResponse, PurchaseVoidRequest
from app.services.inventory_service import InventoryService
from app.utils.numbering import get_next_purchase_number, get_next_supplier_payment_number
from app.utils.money import quantize_money, quantize_qty, to_decimal


class PurchaseService:
    @staticmethod
    def create_purchase(db: Session, payload: PurchaseCreate) -> PurchaseResponse:
        # Idempotency check
        if payload.idempotency_key:
            existing = db.query(Purchase).filter(Purchase.idempotency_key == payload.idempotency_key).first()
            if existing:
                return PurchaseService.get_purchase_by_id(db, existing.id)

        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        if not supplier.is_active:
            raise HTTPException(status_code=400, detail=f"Supplier '{supplier.name}' is inactive/archived")

        if not payload.items or len(payload.items) == 0:
            raise HTTPException(status_code=400, detail="Purchase bill must contain at least one item")

        items_to_process = []
        subtotal = Decimal("0.00")

        for item_data in payload.items:
            qty = quantize_qty(item_data.quantity)
            unit_price = quantize_money(item_data.unit_price)

            if qty <= Decimal("0.000"):
                raise HTTPException(status_code=400, detail="Quantity must be positive")
            if unit_price < Decimal("0.00"):
                raise HTTPException(status_code=400, detail="Unit price cannot be negative")

            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with ID {item_data.product_id} not found")
            if not product.is_active:
                raise HTTPException(status_code=400, detail=f"Product '{product.name}' is inactive/archived")

            item_total = quantize_money(qty * unit_price)
            subtotal += item_total
            items_to_process.append({
                "product": product,
                "quantity": qty,
                "unit_price": unit_price,
                "total": item_total,
            })

        discount = quantize_money(payload.discount or 0.0)
        if discount < Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Discount cannot be negative")
        if discount > subtotal:
            raise HTTPException(
                status_code=400,
                detail=f"Discount (Rs. {discount}) cannot exceed purchase subtotal (Rs. {subtotal})",
            )

        total_amount = quantize_money(subtotal - discount)
        paid_amount = quantize_money(payload.paid_amount or 0.0)
        if paid_amount < Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Paid amount cannot be negative")

        remaining_amount = quantize_money(max(Decimal("0.00"), total_amount - paid_amount))

        try:
            purchase_no = get_next_purchase_number(db)
            purchase_date = payload.purchase_date or datetime.utcnow()

            # Create Master Purchase
            purchase = Purchase(
                purchase_number=purchase_no,
                supplier_id=supplier.id,
                purchase_date=purchase_date,
                subtotal=subtotal,
                discount=discount,
                total_amount=total_amount,
                paid_amount=paid_amount,
                remaining_amount=remaining_amount,
                payment_method=payload.payment_method or "Credit",
                notes=payload.notes,
                status="ACTIVE",
                idempotency_key=payload.idempotency_key,
                created_at=datetime.utcnow(),
            )
            db.add(purchase)
            db.flush()

            # Create Purchase Items & Increment Stock
            for item in items_to_process:
                p = item["product"]
                purchase_item = PurchaseItem(
                    purchase_id=purchase.id,
                    product_id=p.id,
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    total=item["total"],
                )
                db.add(purchase_item)

                # Update product latest catalog purchase price
                if item["unit_price"] > Decimal("0.00"):
                    p.purchase_price = item["unit_price"]

                # Add stock and record inventory audit transaction
                InventoryService.record_transaction(
                    db=db,
                    product_id=p.id,
                    transaction_type="PURCHASE",
                    reference_id=purchase_no,
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    notes=f"Purchased from {supplier.name} via bill {purchase_no}",
                    transaction_date=purchase_date,
                )

            # Auto-record supplier payment if paid_amount > 0
            if paid_amount > Decimal("0.00"):
                spay_no = get_next_supplier_payment_number(db)
                payment = SupplierPayment(
                    payment_number=spay_no,
                    supplier_id=supplier.id,
                    purchase_id=purchase.id,
                    amount=paid_amount,
                    payment_method=payload.payment_method or "Cash",
                    reference=f"Paid on Purchase Bill #{purchase_no}",
                    payment_date=purchase_date,
                    notes=f"Instant payment against bill {purchase_no}",
                    status="ACTIVE",
                )
                db.add(payment)

            # Audit log
            audit = AuditLog(
                entity_type="PURCHASE",
                entity_id=purchase_no,
                action="CREATE",
                user="owner",
                details=json.dumps({
                    "supplier": supplier.name,
                    "total_amount": float(total_amount),
                    "items_count": len(items_to_process),
                    "paid_amount": float(paid_amount),
                }),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(purchase)
        except Exception as e:
            db.rollback()
            raise e

        # Build response
        db_items = db.query(PurchaseItem).filter(PurchaseItem.purchase_id == purchase.id).all()
        item_responses = []
        for dbi in db_items:
            item_responses.append(PurchaseItemResponse(
                id=dbi.id,
                product_id=dbi.product_id,
                product_name=dbi.product.name if dbi.product else None,
                product_code=dbi.product.product_code if dbi.product else None,
                category=dbi.product.category if dbi.product else None,
                unit=dbi.product.unit if dbi.product else None,
                quantity=float(dbi.quantity),
                unit_price=float(dbi.unit_price),
                total=float(dbi.total),
            ))

        return PurchaseResponse(
            id=purchase.id,
            purchase_number=purchase.purchase_number,
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            supplier_code=supplier.supplier_code,
            purchase_date=purchase.purchase_date,
            subtotal=float(purchase.subtotal),
            discount=float(purchase.discount),
            total_amount=float(purchase.total_amount),
            paid_amount=float(purchase.paid_amount),
            remaining_amount=float(purchase.remaining_amount),
            payment_method=purchase.payment_method,
            notes=purchase.notes,
            status=purchase.status,
            void_reason=purchase.void_reason,
            voided_at=purchase.voided_at,
            items=item_responses,
            created_at=purchase.created_at,
        )

    @staticmethod
    def void_purchase(db: Session, purchase_id: int, payload: PurchaseVoidRequest) -> PurchaseResponse:
        purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase bill not found")
        if purchase.status == "VOIDED":
            raise HTTPException(status_code=400, detail="This purchase bill is already voided")

        try:
            # 1. Deduct stock for each item
            for item in purchase.items:
                InventoryService.record_transaction(
                    db=db,
                    product_id=item.product_id,
                    transaction_type="PURCHASE_VOID",
                    reference_id=purchase.purchase_number,
                    quantity=-item.quantity,  # Deduct back
                    unit_price=item.unit_price,
                    notes=f"Stock deduction from voided purchase bill #{purchase.purchase_number}: {payload.void_reason}",
                    transaction_date=datetime.utcnow(),
                )

            # 2. Void linked payments
            linked_payments = db.query(SupplierPayment).filter(
                SupplierPayment.purchase_id == purchase.id,
                SupplierPayment.status == "ACTIVE",
            ).all()
            for p in linked_payments:
                p.status = "VOIDED"
                p.void_reason = f"Linked purchase bill #{purchase.purchase_number} was voided"
                p.voided_at = datetime.utcnow()

            # 3. Mark purchase as VOIDED
            purchase.status = "VOIDED"
            purchase.void_reason = payload.void_reason
            purchase.voided_at = datetime.utcnow()

            # 4. Audit Log
            audit = AuditLog(
                entity_type="PURCHASE",
                entity_id=purchase.purchase_number,
                action="VOID",
                user="owner",
                details=json.dumps({"reason": payload.void_reason, "purchase_number": purchase.purchase_number}),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(purchase)
        except Exception as e:
            db.rollback()
            raise e

        return PurchaseService.get_purchase_by_id(db, purchase.id)

    @staticmethod
    def get_purchase_by_id(db: Session, purchase_id: int) -> PurchaseResponse:
        purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase bill not found")

        item_responses = []
        for dbi in purchase.items:
            item_responses.append(PurchaseItemResponse(
                id=dbi.id,
                product_id=dbi.product_id,
                product_name=dbi.product.name if dbi.product else None,
                product_code=dbi.product.product_code if dbi.product else None,
                category=dbi.product.category if dbi.product else None,
                unit=dbi.product.unit if dbi.product else None,
                quantity=float(dbi.quantity),
                unit_price=float(dbi.unit_price),
                total=float(dbi.total),
            ))

        return PurchaseResponse(
            id=purchase.id,
            purchase_number=purchase.purchase_number,
            supplier_id=purchase.supplier_id,
            supplier_name=purchase.supplier.name if purchase.supplier else "Unknown",
            supplier_code=purchase.supplier.supplier_code if purchase.supplier else "",
            purchase_date=purchase.purchase_date,
            subtotal=float(purchase.subtotal),
            discount=float(purchase.discount),
            total_amount=float(purchase.total_amount),
            paid_amount=float(purchase.paid_amount),
            remaining_amount=float(purchase.remaining_amount),
            payment_method=purchase.payment_method,
            notes=purchase.notes,
            status=purchase.status,
            void_reason=purchase.void_reason,
            voided_at=purchase.voided_at,
            items=item_responses,
            created_at=purchase.created_at,
        )
