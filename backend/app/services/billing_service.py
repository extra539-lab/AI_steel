import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.payment import CustomerPayment
from app.models.audit import AuditLog
from app.schemas.sale import SaleCreate, SaleResponse, SaleItemResponse, SaleVoidRequest
from app.services.inventory_service import InventoryService
from app.services.ledger_service import LedgerService
from app.utils.numbering import get_next_invoice_number, get_next_customer_payment_number
from app.utils.money import quantize_money, quantize_qty, to_decimal, money_to_float


class BillingService:
    @staticmethod
    def create_sale(db: Session, payload: SaleCreate) -> SaleResponse:
        # Idempotency Check
        if payload.idempotency_key:
            existing = db.query(Sale).filter(Sale.idempotency_key == payload.idempotency_key).first()
            if existing:
                return BillingService.get_sale_by_id(db, existing.id)

        # Validate customer
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        if not customer.is_active:
            raise HTTPException(status_code=400, detail=f"Customer '{customer.name}' is inactive/archived")

        if not payload.items or len(payload.items) == 0:
            raise HTTPException(status_code=400, detail="Invoice must contain at least one item")

        # Get customer previous balance before this sale
        prev_summary = LedgerService.get_customer_summary(db, customer.id)
        prev_balance = to_decimal(prev_summary["current_balance"])

        # Validate items and calculate subtotal on backend
        items_to_process = []
        subtotal = Decimal("0.00")

        for item_data in payload.items:
            qty = quantize_qty(item_data.quantity)
            unit_price = quantize_money(item_data.unit_price)

            if qty <= Decimal("0.000"):
                raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
            if unit_price < Decimal("0.00"):
                raise HTTPException(status_code=400, detail="Unit price cannot be negative")

            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with ID {item_data.product_id} not found")
            if not product.is_active:
                raise HTTPException(status_code=400, detail=f"Product '{product.name}' is inactive/archived")

            current_stock = quantize_qty(product.current_stock)
            if current_stock < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{product.name}'. Available: {current_stock} {product.unit}, Requested: {qty} {product.unit}",
                )

            item_total = quantize_money(qty * unit_price)
            # Permanent historical cost snapshot
            unit_cost = quantize_money(product.purchase_price)
            cost_total = quantize_money(qty * unit_cost)

            subtotal += item_total
            items_to_process.append({
                "product": product,
                "quantity": qty,
                "unit_price": unit_price,
                "total": item_total,
                "unit_cost": unit_cost,
                "cost_total": cost_total,
            })

        # Mazdori validation
        mazdori = quantize_money(payload.mazdori or 0.0)
        if mazdori < Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Mazdori cannot be negative")

        # Discount validation
        discount = quantize_money(payload.discount or 0.0)
        if discount < Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Discount cannot be negative")
        if discount > subtotal:
            raise HTTPException(
                status_code=400,
                detail=f"Discount (Rs. {discount}) cannot exceed invoice subtotal (Rs. {subtotal})",
            )

        total_amount = quantize_money(subtotal - discount + mazdori)
        # Customer-facing total excludes labour/mazdori (shop expense)
        customer_total = quantize_money(subtotal - discount)

        paid_amount = quantize_money(payload.paid_amount or 0.0)
        if paid_amount < Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Paid amount cannot be negative")

        # Remaining amount relevant to customer receivable should exclude labour
        remaining_amount = quantize_money(max(Decimal("0.00"), customer_total - paid_amount))

        try:
            invoice_no = get_next_invoice_number(db)
            sale_date = payload.sale_date or datetime.utcnow()

            # Create Master Sale
            sale = Sale(
                invoice_number=invoice_no,
                customer_id=customer.id,
                sale_date=sale_date,
                subtotal=subtotal,
                discount=discount,
                mazdori=mazdori,
                total_amount=total_amount,
                paid_amount=paid_amount,
                # Store remaining_amount as customer-facing remaining (exclude mazdori)
                remaining_amount=remaining_amount,
                payment_method=payload.payment_method or "Cash",
                notes=payload.notes,
                status="ACTIVE",
                idempotency_key=payload.idempotency_key,
                created_at=datetime.utcnow(),
            )
            db.add(sale)
            db.flush()

            # Create Items & Deduct Stock
            item_responses: List[SaleItemResponse] = []
            for item in items_to_process:
                p = item["product"]
                sale_item = SaleItem(
                    sale_id=sale.id,
                    product_id=p.id,
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    total=item["total"],
                    unit_cost=item["unit_cost"],
                    cost_total=item["cost_total"],
                )
                db.add(sale_item)

                # Deduct stock and record inventory audit transaction
                InventoryService.record_transaction(
                    db=db,
                    product_id=p.id,
                    transaction_type="SALE",
                    reference_id=invoice_no,
                    quantity=-item["quantity"],
                    unit_price=item["unit_price"],
                    notes=f"Sold in invoice {invoice_no} to {customer.name}",
                    transaction_date=sale_date,
                )

                item_responses.append(SaleItemResponse(
                    id=0,
                    product_id=p.id,
                    product_name=p.name,
                    product_code=p.product_code,
                    category=p.category,
                    unit=p.unit,
                    quantity=float(item["quantity"]),
                    unit_price=float(item["unit_price"]),
                    total=float(item["total"]),
                    unit_cost=float(item["unit_cost"]),
                    cost_total=float(item["cost_total"]),
                ))

            # Auto-record customer payment if paid_amount > 0
            if paid_amount > Decimal("0.00"):
                cpay_no = get_next_customer_payment_number(db)
                payment = CustomerPayment(
                    payment_number=cpay_no,
                    customer_id=customer.id,
                    sale_id=sale.id,
                    amount=paid_amount,
                    payment_method=payload.payment_method or "Cash",
                    reference=f"Paid on Invoice #{invoice_no}",
                    payment_date=sale_date,
                    notes=f"Instant payment against {invoice_no}",
                    status="ACTIVE",
                )
                db.add(payment)

            # Audit Log
            audit = AuditLog(
                entity_type="SALE",
                entity_id=invoice_no,
                action="CREATE",
                user="owner",
                details=json.dumps({
                    "customer": customer.name,
                    "total_amount": float(total_amount),
                    "items_count": len(items_to_process),
                    "paid_amount": float(paid_amount),
                }),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(sale)
        except Exception as e:
            db.rollback()
            raise e

        # Populate correct item IDs
        db_items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        final_item_responses = []
        for dbi in db_items:
            final_item_responses.append(SaleItemResponse(
                id=dbi.id,
                product_id=dbi.product_id,
                product_name=dbi.product.name if dbi.product else None,
                product_code=dbi.product.product_code if dbi.product else None,
                category=dbi.product.category if dbi.product else None,
                unit=dbi.product.unit if dbi.product else None,
                quantity=float(dbi.quantity),
                unit_price=float(dbi.unit_price),
                total=float(dbi.total),
                unit_cost=float(dbi.unit_cost) if dbi.unit_cost is not None else None,
                cost_total=float(dbi.cost_total) if dbi.cost_total is not None else None,
            ))

        # New customer balance should be computed against customer-facing totals (exclude mazdori)
        new_balance = prev_balance + customer_total - paid_amount

        return SaleResponse(
            id=sale.id,
            invoice_number=sale.invoice_number,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_code=customer.customer_code,
            customer_phone=customer.phone,
            customer_address=customer.address,
            sale_date=sale.sale_date,
            subtotal=float(sale.subtotal),
            discount=float(sale.discount),
            mazdori=float(sale.mazdori),
            total_amount=float(sale.total_amount),
            paid_amount=float(sale.paid_amount),
            remaining_amount=float(sale.remaining_amount),
            payment_method=sale.payment_method,
            notes=sale.notes,
            status=sale.status,
            void_reason=sale.void_reason,
            voided_at=sale.voided_at,
            items=final_item_responses,
            customer_previous_balance=float(prev_balance),
            customer_total_balance=float(new_balance),
            created_at=sale.created_at,
        )

    @staticmethod
    def void_sale(db: Session, sale_id: int, payload: SaleVoidRequest) -> SaleResponse:
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale invoice not found")
        if sale.status == "VOIDED":
            raise HTTPException(status_code=400, detail="This invoice is already voided")

        try:
            # 1. Reverse stock for each item
            for item in sale.items:
                InventoryService.record_transaction(
                    db=db,
                    product_id=item.product_id,
                    transaction_type="SALE_VOID",
                    reference_id=sale.invoice_number,
                    quantity=item.quantity,  # Add back to stock
                    unit_price=item.unit_price,
                    notes=f"Stock reversal from voided invoice #{sale.invoice_number}: {payload.void_reason}",
                    transaction_date=datetime.utcnow(),
                )

            # 2. Void any linked instant payments
            linked_payments = db.query(CustomerPayment).filter(
                CustomerPayment.sale_id == sale.id,
                CustomerPayment.status == "ACTIVE",
            ).all()
            for p in linked_payments:
                p.status = "VOIDED"
                p.void_reason = f"Linked invoice #{sale.invoice_number} was voided"
                p.voided_at = datetime.utcnow()

            # 3. Mark sale as VOIDED
            sale.status = "VOIDED"
            sale.void_reason = payload.void_reason
            sale.voided_at = datetime.utcnow()

            # 4. Audit Log
            audit = AuditLog(
                entity_type="SALE",
                entity_id=sale.invoice_number,
                action="VOID",
                user="owner",
                details=json.dumps({"reason": payload.void_reason, "invoice_number": sale.invoice_number}),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(sale)
        except Exception as e:
            db.rollback()
            raise e

        return BillingService.get_sale_by_id(db, sale.id)

    @staticmethod
    def get_sale_by_id(db: Session, sale_id: int) -> SaleResponse:
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale invoice not found")

        customer = sale.customer
        summary = LedgerService.get_customer_summary(db, customer.id) if customer else {"current_balance": 0.0}

        item_responses = []
        for dbi in sale.items:
            item_responses.append(SaleItemResponse(
                id=dbi.id,
                product_id=dbi.product_id,
                product_name=dbi.product.name if dbi.product else None,
                product_code=dbi.product.product_code if dbi.product else None,
                category=dbi.product.category if dbi.product else None,
                unit=dbi.product.unit if dbi.product else None,
                quantity=float(dbi.quantity),
                unit_price=float(dbi.unit_price),
                total=float(dbi.total),
                unit_cost=float(dbi.unit_cost) if dbi.unit_cost is not None else None,
                cost_total=float(dbi.cost_total) if dbi.cost_total is not None else None,
            ))

        prev_bal = summary["current_balance"] - float(sale.remaining_amount) if sale.status == "ACTIVE" else summary["current_balance"]

        return SaleResponse(
            id=sale.id,
            invoice_number=sale.invoice_number,
            customer_id=sale.customer_id,
            customer_name=customer.name if customer else "Unknown",
            customer_code=customer.customer_code if customer else "",
            customer_phone=customer.phone if customer else "",
            customer_address=customer.address if customer else "",
            sale_date=sale.sale_date,
            subtotal=float(sale.subtotal),
            discount=float(sale.discount),
            mazdori=float(sale.mazdori),
            total_amount=float(sale.total_amount),
            paid_amount=float(sale.paid_amount),
            remaining_amount=float(sale.remaining_amount),
            payment_method=sale.payment_method,
            notes=sale.notes,
            status=sale.status,
            void_reason=sale.void_reason,
            voided_at=sale.voided_at,
            items=item_responses,
            customer_previous_balance=prev_bal,
            customer_total_balance=summary["current_balance"],
            created_at=sale.created_at,
        )
