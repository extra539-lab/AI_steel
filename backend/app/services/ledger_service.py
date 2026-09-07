from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.sale import Sale
from app.models.purchase import Purchase
from app.models.payment import CustomerPayment, SupplierPayment
from app.schemas.customer import CustomerLedgerEntry, CustomerLedgerResponse, CustomerResponse
from app.schemas.supplier import SupplierLedgerEntry, SupplierLedgerResponse, SupplierResponse
from app.utils.money import quantize_money, to_decimal, money_to_float


class LedgerService:
    @staticmethod
    def get_customer_summary(db: Session, customer_id: int) -> Dict[str, float]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return {"opening_balance": 0.0, "total_sales": 0.0, "total_paid": 0.0, "current_balance": 0.0}

        op_bal = quantize_money(customer.opening_balance or 0.0)

        # Only active sales — compute customer-facing sales (exclude labour/mazdori)
        total_sales_val = db.query(func.coalesce(func.sum(Sale.subtotal - Sale.discount), 0.0)).filter(
            Sale.customer_id == customer_id,
            Sale.status == "ACTIVE",
        ).scalar()
        total_sales = quantize_money(total_sales_val)

        # Compute payments applied to customer-facing amounts.
        # Payments not linked to a sale are treated as general payments (advances) and fully apply.
        standalone_paid_val = db.query(func.coalesce(func.sum(CustomerPayment.amount), 0.0)).filter(
            CustomerPayment.customer_id == customer_id,
            CustomerPayment.status == "ACTIVE",
            CustomerPayment.sale_id == None,
        ).scalar()
        standalone_paid = quantize_money(standalone_paid_val)

        # For payments linked to sales, only count up to the sale's customer-facing amount (subtotal - discount)
        sales = db.query(Sale).filter(Sale.customer_id == customer_id, Sale.status == "ACTIVE").all()
        applied_paid_from_sales = Decimal("0.00")
        for s in sales:
            sale_customer_amount = quantize_money(s.subtotal - s.discount)
            payments_for_sale = db.query(func.coalesce(func.sum(CustomerPayment.amount), 0.0)).filter(
                CustomerPayment.customer_id == customer_id,
                CustomerPayment.sale_id == s.id,
                CustomerPayment.status == "ACTIVE",
            ).scalar() or Decimal("0.00")
            payments_for_sale = quantize_money(payments_for_sale)
            applied_paid_from_sales += quantize_money(min(sale_customer_amount, payments_for_sale))

        total_paid_applied = quantize_money(standalone_paid + applied_paid_from_sales)

        # Current balance should be opening + total_sales (customer-facing) - applied payments
        current_balance = quantize_money(op_bal + total_sales - total_paid_applied)
        return {
            "opening_balance": float(op_bal),
            "total_sales": float(total_sales),
            "total_paid": float(total_paid_applied),
            "current_balance": float(current_balance),
        }

    @staticmethod
    def get_customer_ledger(db: Session, customer_id: int) -> CustomerLedgerResponse:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Customer not found")

        summary = LedgerService.get_customer_summary(db, customer_id)
        cust_response = CustomerResponse(
            id=customer.id,
            customer_code=customer.customer_code,
            name=customer.name,
            phone=customer.phone,
            address=customer.address,
            opening_balance=float(customer.opening_balance),
            is_active=customer.is_active,
            current_balance=summary["current_balance"],
            total_sales=summary["total_sales"],
            total_paid=summary["total_paid"],
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )

        timeline: List[Dict[str, Any]] = []

        # Opening balance entry
        op_bal = quantize_money(customer.opening_balance or 0.0)
        if op_bal != Decimal("0.00"):
            timeline.append({
                "date": customer.created_at or datetime.utcnow(),
                "type": "OPENING_BALANCE",
                "reference": "OPENING",
                "debit": op_bal,
                "credit": Decimal("0.00"),
                "notes": "Opening Receivable Balance",
            })

        # Sales (Active & Voided)
        sales = db.query(Sale).filter(Sale.customer_id == customer_id).order_by(Sale.sale_date, Sale.id).all()
        for s in sales:
            if s.status == "ACTIVE":
                # For customer ledger, treat sale amount as product subtotal minus discount (exclude mazdori)
                sale_customer_amount = quantize_money(s.subtotal - s.discount)
                timeline.append({
                    "date": s.sale_date,
                    "type": "SALE",
                    "reference": s.invoice_number,
                    "debit": sale_customer_amount,
                    "credit": Decimal("0.00"),
                    "notes": f"Sale Invoice #{s.invoice_number}" + (f" ({s.notes})" if s.notes else ""),
                })
            else:
                timeline.append({
                    "date": s.voided_at or s.sale_date,
                    "type": "SALE_VOID",
                    "reference": s.invoice_number,
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                    "notes": f"VOIDED Invoice #{s.invoice_number} - {s.void_reason or 'Cancelled'}",
                })

        # Customer Payments
        payments = db.query(CustomerPayment).filter(CustomerPayment.customer_id == customer_id).order_by(CustomerPayment.payment_date, CustomerPayment.id).all()
        for p in payments:
            if p.status == "ACTIVE":
                timeline.append({
                    "date": p.payment_date,
                    "type": "PAYMENT",
                    "reference": p.payment_number,
                    "debit": Decimal("0.00"),
                    "credit": quantize_money(p.amount),
                    "notes": f"Payment Received ({p.payment_method})" + (f" - Ref: {p.reference}" if p.reference else "") + (f" - {p.notes}" if p.notes else ""),
                })
            else:
                timeline.append({
                    "date": p.voided_at or p.payment_date,
                    "type": "PAYMENT_VOID",
                    "reference": p.payment_number,
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                    "notes": f"VOIDED Payment #{p.payment_number} - {p.void_reason or 'Cancelled'}",
                })

        # Sort timeline chronologically
        timeline.sort(key=lambda x: x["date"])

        running_balance = Decimal("0.00")
        entries: List[CustomerLedgerEntry] = []
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for item in timeline:
            total_debit += item["debit"]
            total_credit += item["credit"]
            running_balance += item["debit"] - item["credit"]

            entries.append(CustomerLedgerEntry(
                date=item["date"],
                type=item["type"],
                reference=item["reference"],
                debit=float(item["debit"]),
                credit=float(item["credit"]),
                balance=float(running_balance),
                notes=item["notes"],
            ))

        return CustomerLedgerResponse(
            customer=cust_response,
            entries=entries,
            total_debit=float(total_debit),
            total_credit=float(total_credit),
            final_balance=float(running_balance),
        )

    @staticmethod
    def get_supplier_summary(db: Session, supplier_id: int) -> Dict[str, float]:
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier:
            return {"opening_balance": 0.0, "total_purchases": 0.0, "total_paid": 0.0, "current_balance": 0.0}

        op_bal = quantize_money(supplier.opening_balance or 0.0)

        total_purchases_val = db.query(func.coalesce(func.sum(Purchase.total_amount), 0.0)).filter(
            Purchase.supplier_id == supplier_id,
            Purchase.status == "ACTIVE",
        ).scalar()
        total_purchases = quantize_money(total_purchases_val)

        total_paid_val = db.query(func.coalesce(func.sum(SupplierPayment.amount), 0.0)).filter(
            SupplierPayment.supplier_id == supplier_id,
            SupplierPayment.status == "ACTIVE",
        ).scalar()
        total_paid = quantize_money(total_paid_val)

        current_balance = quantize_money(op_bal + total_purchases - total_paid)
        return {
            "opening_balance": float(op_bal),
            "total_purchases": float(total_purchases),
            "total_paid": float(total_paid),
            "current_balance": float(current_balance),
        }

    @staticmethod
    def get_supplier_ledger(db: Session, supplier_id: int) -> SupplierLedgerResponse:
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Supplier not found")

        summary = LedgerService.get_supplier_summary(db, supplier_id)
        sup_response = SupplierResponse(
            id=supplier.id,
            supplier_code=supplier.supplier_code,
            name=supplier.name,
            phone=supplier.phone,
            address=supplier.address,
            opening_balance=float(supplier.opening_balance),
            is_active=supplier.is_active,
            current_balance=summary["current_balance"],
            total_purchases=summary["total_purchases"],
            total_paid=summary["total_paid"],
            created_at=supplier.created_at,
            updated_at=supplier.updated_at,
        )

        timeline: List[Dict[str, Any]] = []

        op_bal = quantize_money(supplier.opening_balance or 0.0)
        if op_bal != Decimal("0.00"):
            timeline.append({
                "date": supplier.created_at or datetime.utcnow(),
                "type": "OPENING_BALANCE",
                "reference": "OPENING",
                "debit": Decimal("0.00"),
                "credit": op_bal,
                "notes": "Opening Payable Balance",
            })

        purchases = db.query(Purchase).filter(Purchase.supplier_id == supplier_id).order_by(Purchase.purchase_date, Purchase.id).all()
        for p in purchases:
            if p.status == "ACTIVE":
                timeline.append({
                    "date": p.purchase_date,
                    "type": "PURCHASE",
                    "reference": p.purchase_number,
                    "debit": Decimal("0.00"),
                    "credit": quantize_money(p.total_amount),
                    "notes": f"Purchase Bill #{p.purchase_number}" + (f" ({p.notes})" if p.notes else ""),
                })
            else:
                timeline.append({
                    "date": p.voided_at or p.purchase_date,
                    "type": "PURCHASE_VOID",
                    "reference": p.purchase_number,
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                    "notes": f"VOIDED Purchase #{p.purchase_number} - {p.void_reason or 'Cancelled'}",
                })

        payments = db.query(SupplierPayment).filter(SupplierPayment.supplier_id == supplier_id).order_by(SupplierPayment.payment_date, SupplierPayment.id).all()
        for sp in payments:
            if sp.status == "ACTIVE":
                timeline.append({
                    "date": sp.payment_date,
                    "type": "PAYMENT",
                    "reference": sp.payment_number,
                    "debit": quantize_money(sp.amount),
                    "credit": Decimal("0.00"),
                    "notes": f"Payment Made ({sp.payment_method})" + (f" - Ref: {sp.reference}" if sp.reference else "") + (f" - {sp.notes}" if sp.notes else ""),
                })
            else:
                timeline.append({
                    "date": sp.voided_at or sp.payment_date,
                    "type": "PAYMENT_VOID",
                    "reference": sp.payment_number,
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                    "notes": f"VOIDED Payment #{sp.payment_number} - {sp.void_reason or 'Cancelled'}",
                })

        timeline.sort(key=lambda x: x["date"])

        running_balance = Decimal("0.00")
        entries: List[SupplierLedgerEntry] = []
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for item in timeline:
            total_debit += item["debit"]
            total_credit += item["credit"]
            running_balance += item["credit"] - item["debit"]

            entries.append(SupplierLedgerEntry(
                date=item["date"],
                type=item["type"],
                reference=item["reference"],
                debit=float(item["debit"]),
                credit=float(item["credit"]),
                balance=float(running_balance),
                notes=item["notes"],
            ))

        return SupplierLedgerResponse(
            supplier=sup_response,
            entries=entries,
            total_credit=float(total_credit),
            total_debit=float(total_debit),
            final_balance=float(running_balance),
        )
