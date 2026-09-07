import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.sale import Sale
from app.models.purchase import Purchase
from app.models.payment import CustomerPayment, SupplierPayment
from app.models.audit import AuditLog
from app.schemas.payment import (
    CustomerPaymentCreate,
    CustomerPaymentResponse,
    CustomerPaymentVoidRequest,
    SupplierPaymentCreate,
    SupplierPaymentResponse,
    SupplierPaymentVoidRequest,
)
from app.utils.numbering import get_next_customer_payment_number, get_next_supplier_payment_number
from app.utils.money import quantize_money, to_decimal


class PaymentService:
    @staticmethod
    def create_customer_payment(db: Session, payload: CustomerPaymentCreate) -> CustomerPaymentResponse:
        # Idempotency check
        if payload.idempotency_key:
            existing = db.query(CustomerPayment).filter(CustomerPayment.idempotency_key == payload.idempotency_key).first()
            if existing:
                return PaymentService._build_customer_payment_response(existing)

        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        if not customer.is_active:
            raise HTTPException(status_code=400, detail=f"Customer '{customer.name}' is inactive/archived")

        amount = quantize_money(payload.amount)
        if amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        # Validate linked sale if provided
        sale = None
        if payload.sale_id:
            sale = db.query(Sale).filter(Sale.id == payload.sale_id).first()
            if not sale:
                raise HTTPException(status_code=404, detail=f"Linked sale invoice with ID {payload.sale_id} not found")
            if sale.customer_id != payload.customer_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sale invoice #{sale.invoice_number} belongs to another customer (ID: {sale.customer_id}), not customer ID {payload.customer_id}",
                )
            if sale.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Sale invoice #{sale.invoice_number} is {sale.status} and cannot receive payments",
                )

        try:
            payment_no = get_next_customer_payment_number(db)
            payment = CustomerPayment(
                payment_number=payment_no,
                customer_id=customer.id,
                sale_id=payload.sale_id,
                amount=amount,
                payment_method=payload.payment_method or "Cash",
                reference=payload.reference,
                payment_date=payload.payment_date or datetime.utcnow(),
                notes=payload.notes,
                status="ACTIVE",
                idempotency_key=payload.idempotency_key,
                created_at=datetime.utcnow(),
            )
            db.add(payment)

            # If linked to a sale, update sale paid and remaining amount
            if sale:
                current_paid = quantize_money(sale.paid_amount)
                new_paid = quantize_money(current_paid + amount)
                sale.paid_amount = new_paid
                # Update remaining relative to customer-facing total (exclude mazdori)
                customer_total = quantize_money(sale.subtotal - sale.discount)
                sale.remaining_amount = quantize_money(max(Decimal("0.00"), customer_total - new_paid))

            # Audit Log
            audit = AuditLog(
                entity_type="CUSTOMER_PAYMENT",
                entity_id=payment_no,
                action="CREATE",
                user="owner",
                details=json.dumps({
                    "customer": customer.name,
                    "amount": float(amount),
                    "sale_id": payload.sale_id,
                    "payment_method": payload.payment_method,
                }),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(payment)
        except Exception as e:
            db.rollback()
            raise e

        return PaymentService._build_customer_payment_response(payment)

    @staticmethod
    def void_customer_payment(db: Session, payment_id: int, payload: CustomerPaymentVoidRequest) -> CustomerPaymentResponse:
        payment = db.query(CustomerPayment).filter(CustomerPayment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Customer payment not found")
        if payment.status == "VOIDED":
            raise HTTPException(status_code=400, detail="This payment is already voided")

        try:
            # If linked to sale, reverse the paid amount on that sale
            if payment.sale_id:
                sale = db.query(Sale).filter(Sale.id == payment.sale_id).first()
                if sale:
                    sale.paid_amount = quantize_money(max(Decimal("0.00"), sale.paid_amount - payment.amount))
                    customer_total = quantize_money(sale.subtotal - sale.discount)
                    sale.remaining_amount = quantize_money(max(Decimal("0.00"), customer_total - sale.paid_amount))

            payment.status = "VOIDED"
            payment.void_reason = payload.void_reason
            payment.voided_at = datetime.utcnow()

            audit = AuditLog(
                entity_type="CUSTOMER_PAYMENT",
                entity_id=payment.payment_number,
                action="VOID",
                user="owner",
                details=json.dumps({"reason": payload.void_reason, "payment_number": payment.payment_number}),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(payment)
        except Exception as e:
            db.rollback()
            raise e

        return PaymentService._build_customer_payment_response(payment)

    @staticmethod
    def create_supplier_payment(db: Session, payload: SupplierPaymentCreate) -> SupplierPaymentResponse:
        # Idempotency check
        if payload.idempotency_key:
            existing = db.query(SupplierPayment).filter(SupplierPayment.idempotency_key == payload.idempotency_key).first()
            if existing:
                return PaymentService._build_supplier_payment_response(existing)

        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        if not supplier.is_active:
            raise HTTPException(status_code=400, detail=f"Supplier '{supplier.name}' is inactive/archived")

        amount = quantize_money(payload.amount)
        if amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        purchase = None
        if payload.purchase_id:
            purchase = db.query(Purchase).filter(Purchase.id == payload.purchase_id).first()
            if not purchase:
                raise HTTPException(status_code=404, detail=f"Linked purchase bill with ID {payload.purchase_id} not found")
            if purchase.supplier_id != payload.supplier_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Purchase bill #{purchase.purchase_number} belongs to another supplier (ID: {purchase.supplier_id}), not supplier ID {payload.supplier_id}",
                )
            if purchase.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Purchase bill #{purchase.purchase_number} is {purchase.status} and cannot receive payments",
                )

        try:
            payment_no = get_next_supplier_payment_number(db)
            payment = SupplierPayment(
                payment_number=payment_no,
                supplier_id=supplier.id,
                purchase_id=payload.purchase_id,
                amount=amount,
                payment_method=payload.payment_method or "Cash",
                reference=payload.reference,
                payment_date=payload.payment_date or datetime.utcnow(),
                notes=payload.notes,
                status="ACTIVE",
                idempotency_key=payload.idempotency_key,
                created_at=datetime.utcnow(),
            )
            db.add(payment)

            if purchase:
                current_paid = quantize_money(purchase.paid_amount)
                new_paid = quantize_money(current_paid + amount)
                purchase.paid_amount = new_paid
                purchase.remaining_amount = quantize_money(max(Decimal("0.00"), purchase.total_amount - new_paid))

            audit = AuditLog(
                entity_type="SUPPLIER_PAYMENT",
                entity_id=payment_no,
                action="CREATE",
                user="owner",
                details=json.dumps({
                    "supplier": supplier.name,
                    "amount": float(amount),
                    "purchase_id": payload.purchase_id,
                    "payment_method": payload.payment_method,
                }),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(payment)
        except Exception as e:
            db.rollback()
            raise e

        return PaymentService._build_supplier_payment_response(payment)

    @staticmethod
    def void_supplier_payment(db: Session, payment_id: int, payload: SupplierPaymentVoidRequest) -> SupplierPaymentResponse:
        payment = db.query(SupplierPayment).filter(SupplierPayment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Supplier payment not found")
        if payment.status == "VOIDED":
            raise HTTPException(status_code=400, detail="This payment is already voided")

        try:
            if payment.purchase_id:
                purchase = db.query(Purchase).filter(Purchase.id == payment.purchase_id).first()
                if purchase:
                    purchase.paid_amount = quantize_money(max(Decimal("0.00"), purchase.paid_amount - payment.amount))
                    purchase.remaining_amount = quantize_money(max(Decimal("0.00"), purchase.total_amount - purchase.paid_amount))

            payment.status = "VOIDED"
            payment.void_reason = payload.void_reason
            payment.voided_at = datetime.utcnow()

            audit = AuditLog(
                entity_type="SUPPLIER_PAYMENT",
                entity_id=payment.payment_number,
                action="VOID",
                user="owner",
                details=json.dumps({"reason": payload.void_reason, "payment_number": payment.payment_number}),
                created_at=datetime.utcnow(),
            )
            db.add(audit)

            db.commit()
            db.refresh(payment)
        except Exception as e:
            db.rollback()
            raise e

        return PaymentService._build_supplier_payment_response(payment)

    @staticmethod
    def list_customer_payments(db: Session, customer_id: Optional[int] = None, limit: int = 200) -> List[CustomerPaymentResponse]:
        query = db.query(CustomerPayment)
        if customer_id:
            query = query.filter(CustomerPayment.customer_id == customer_id)
        payments = query.order_by(desc(CustomerPayment.payment_date), desc(CustomerPayment.id)).limit(limit).all()
        return [PaymentService._build_customer_payment_response(p) for p in payments]

    @staticmethod
    def list_supplier_payments(db: Session, supplier_id: Optional[int] = None, limit: int = 200) -> List[SupplierPaymentResponse]:
        query = db.query(SupplierPayment)
        if supplier_id:
            query = query.filter(SupplierPayment.supplier_id == supplier_id)
        payments = query.order_by(desc(SupplierPayment.payment_date), desc(SupplierPayment.id)).limit(limit).all()
        return [PaymentService._build_supplier_payment_response(p) for p in payments]

    @staticmethod
    def _build_customer_payment_response(p: CustomerPayment) -> CustomerPaymentResponse:
        return CustomerPaymentResponse(
            id=p.id,
            payment_number=p.payment_number,
            customer_id=p.customer_id,
            customer_name=p.customer.name if p.customer else "Unknown",
            customer_code=p.customer.customer_code if p.customer else "",
            sale_id=p.sale_id,
            amount=float(p.amount),
            payment_method=p.payment_method,
            reference=p.reference,
            payment_date=p.payment_date,
            notes=p.notes,
            status=p.status,
            void_reason=p.void_reason,
            voided_at=p.voided_at,
            created_at=p.created_at,
        )

    @staticmethod
    def _build_supplier_payment_response(p: SupplierPayment) -> SupplierPaymentResponse:
        return SupplierPaymentResponse(
            id=p.id,
            payment_number=p.payment_number,
            supplier_id=p.supplier_id,
            supplier_name=p.supplier.name if p.supplier else "Unknown",
            supplier_code=p.supplier.supplier_code if p.supplier else "",
            purchase_id=p.purchase_id,
            amount=float(p.amount),
            payment_method=p.payment_method,
            reference=p.reference,
            payment_date=p.payment_date,
            notes=p.notes,
            status=p.status,
            void_reason=p.void_reason,
            voided_at=p.voided_at,
            created_at=p.created_at,
        )
