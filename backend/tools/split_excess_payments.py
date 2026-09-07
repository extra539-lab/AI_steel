#!/usr/bin/env python3
from decimal import Decimal
from datetime import datetime
from app.core.database import SessionLocal
from app.models.sale import Sale
from app.models.payment import CustomerPayment
from app.utils.numbering import get_next_customer_payment_number
from app.utils.money import quantize_money

def main():
    db = SessionLocal()
    try:
        # Find sales where total payments linked exceed customer-facing sale amount
        sales = db.query(Sale).filter(Sale.status == 'ACTIVE').all()
        changed = 0
        for s in sales:
            sale_customer = quantize_money(s.subtotal - s.discount)
            payments = db.query(CustomerPayment).filter(CustomerPayment.sale_id == s.id, CustomerPayment.status == 'ACTIVE').order_by(CustomerPayment.payment_date, CustomerPayment.id).all()
            total_linked = sum((p.amount or Decimal('0.00')) for p in payments)
            total_linked = quantize_money(total_linked)
            if total_linked <= sale_customer:
                continue

            print(f"Sale #{s.invoice_number} has linked payments {total_linked} > customer_amount {sale_customer}")

            applied = Decimal('0.00')
            for p in payments:
                p_amount = quantize_money(p.amount or Decimal('0.00'))
                remaining_to_apply = quantize_money(max(Decimal('0.00'), sale_customer - applied))
                if remaining_to_apply >= p_amount:
                    applied += p_amount
                    continue

                # Need to split this payment: apply_part to sale, excess becomes standalone
                apply_part = remaining_to_apply
                excess = quantize_money(p_amount - apply_part)

                if apply_part == Decimal('0.00'):
                    # Convert entire payment to standalone (remove sale_id)
                    print(f" Converting payment {p.payment_number} entirely to standalone amount {p_amount}")
                    p.sale_id = None
                    # keep p.amount as-is
                else:
                    print(f" Splitting payment {p.payment_number}: apply {apply_part}, excess {excess}")
                    # reduce original payment to apply_part
                    p.amount = apply_part
                    # create new standalone payment for excess
                    new_no = get_next_customer_payment_number(db)
                    new_p = CustomerPayment(
                        payment_number=new_no,
                        customer_id=p.customer_id,
                        sale_id=None,
                        amount=excess,
                        payment_method=p.payment_method,
                        reference=f"Excess from {p.payment_number}",
                        payment_date=p.payment_date or datetime.utcnow(),
                        notes=f"Split excess from payment {p.payment_number}",
                        status='ACTIVE',
                        created_at=datetime.utcnow(),
                    )
                    db.add(new_p)

                applied = quantize_money(applied + apply_part)
                changed += 1

            # After adjustments, recompute sale paid_amount and remaining_amount based on customer-facing total
            new_paid = db.query(CustomerPayment).filter(CustomerPayment.sale_id == s.id, CustomerPayment.status == 'ACTIVE').with_entities(func.coalesce(func.sum(CustomerPayment.amount), Decimal('0.00'))).scalar() or Decimal('0.00')
            new_paid = quantize_money(new_paid)
            s.paid_amount = new_paid
            s.remaining_amount = quantize_money(max(Decimal('0.00'), sale_customer - new_paid))

        if changed > 0:
            db.commit()
            print(f"Adjusted {changed} payments and updated sales.")
        else:
            print("No excess linked payments found.")
    finally:
        db.close()

if __name__ == '__main__':
    # Delay import of func to avoid top-level overhead
    from sqlalchemy import func
    main()
