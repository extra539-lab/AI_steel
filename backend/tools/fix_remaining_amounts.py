#!/usr/bin/env python3
from decimal import Decimal
from app.core.database import SessionLocal
from app.models.sale import Sale
from app.utils.money import quantize_money

def main():
    db = SessionLocal()
    try:
        sales = db.query(Sale).all()
        print(f"Found {len(sales)} sales to inspect")
        changed = 0
        for s in sales:
            subtotal = s.subtotal or Decimal('0.00')
            discount = s.discount or Decimal('0.00')
            paid = s.paid_amount or Decimal('0.00')
            customer_total = quantize_money(subtotal - discount)
            correct_remaining = quantize_money(max(Decimal('0.00'), customer_total - paid))
            if quantize_money(s.remaining_amount or Decimal('0.00')) != correct_remaining:
                print(f"Sale #{s.invoice_number}: remaining {s.remaining_amount} -> {correct_remaining}")
                s.remaining_amount = correct_remaining
                changed += 1

        if changed > 0:
            db.commit()
            print(f"Updated {changed} sales remaining_amount fields.")
        else:
            print("No changes needed.")
    finally:
        db.close()

if __name__ == '__main__':
    main()
