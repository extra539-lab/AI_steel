#!/usr/bin/env python3
from decimal import Decimal
from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.sale import Sale
from app.models.payment import CustomerPayment
from app.utils.money import quantize_money

def inspect():
    db = SessionLocal()
    try:
        customers = db.query(Customer).all()
        for c in customers:
            op_bal = quantize_money(c.opening_balance or Decimal('0.00'))
            # customer-facing sales sum
            sales = db.query(Sale).filter(Sale.customer_id == c.id, Sale.status == 'ACTIVE').all()
            total_sales = Decimal('0.00')
            for s in sales:
                total_sales += quantize_money(s.subtotal - s.discount)

            # payments
            payments = db.query(CustomerPayment).filter(CustomerPayment.customer_id == c.id, CustomerPayment.status == 'ACTIVE').all()
            total_paid = Decimal('0.00')
            for p in payments:
                total_paid += quantize_money(p.amount)

            computed = quantize_money(op_bal + total_sales - total_paid)
            # fetch stored summary via LedgerService logic? Here show raw values
            print('---')
            print(f'Customer {c.id} - {c.name}')
            print(f' opening_balance: {op_bal}')
            print(f' total_sales (subtotal-discount sum): {total_sales}')
            print(f' total_paid (sum payments): {total_paid}')
            print(f' computed_balance = opening + sales - paid = {computed}')
            # show individual problematic records
            if computed < Decimal('0.00') or c.opening_balance < 0:
                print(' POSSIBLE ISSUE: negative computed or opening balance')
                print(' Active Sales (id, invoice, subtotal, discount, mazdori, total_amount):')
                for s in sales:
                    print(f'  {s.id} #{s.invoice_number}: subtotal={s.subtotal} discount={s.discount} mazdori={s.mazdori} total={s.total_amount} paid={s.paid_amount} remaining={s.remaining_amount}')
                print(' Payments (id, payment_number, amount, sale_id):')
                for p in payments:
                    print(f'  {p.id} #{p.payment_number}: amount={p.amount} sale_id={p.sale_id} date={p.payment_date}')
    finally:
        db.close()

if __name__ == '__main__':
    inspect()
