#!/usr/bin/env python3
from datetime import datetime
from app.core.database import SessionLocal
from app.models.payment import CustomerPayment
from app.models.audit import AuditLog

def main():
    db = SessionLocal()
    try:
        payments = db.query(CustomerPayment).filter(CustomerPayment.reference.like('Excess from %')).all()
        if not payments:
            print('No excess payments found to mark as labour.')
            return
        for p in payments:
            print(f'Marking payment {p.payment_number} amount={p.amount} as LABOUR_COLLECTED')
            p.status = 'LABOUR'
            # add audit log
            audit = AuditLog(
                entity_type='CUSTOMER_PAYMENT',
                entity_id=p.payment_number,
                action='MARK_LABOUR',
                user='migration',
                details=f'Marked payment {p.payment_number} as labour-collected (converted from excess).',
                created_at=datetime.utcnow(),
            )
            db.add(audit)
        db.commit()
        print(f'Marked {len(payments)} payments.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
