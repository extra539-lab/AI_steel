from datetime import datetime
from sqlalchemy.orm import Session
from app.models.sequence import DocumentSequence


def get_next_sequence_number(db: Session, sequence_type: str, prefix: str, padding: int = 5) -> str:
    """Concurrency-safe sequence number generator using DocumentSequence table."""
    seq = db.query(DocumentSequence).filter(DocumentSequence.sequence_type == sequence_type).first()
    if not seq:
        seq = DocumentSequence(
            sequence_type=sequence_type,
            prefix=prefix,
            last_number=1,
            padding=padding,
            updated_at=datetime.utcnow(),
        )
        db.add(seq)
        db.flush()
        return f"{prefix}{1:0{padding}d}"

    seq.last_number += 1
    seq.updated_at = datetime.utcnow()
    db.flush()
    return f"{seq.prefix}{seq.last_number:0{seq.padding}d}"


def get_next_product_code(db: Session) -> str:
    return get_next_sequence_number(db, "PRODUCT", "PRD-", 3)


def get_next_supplier_code(db: Session) -> str:
    return get_next_sequence_number(db, "SUPPLIER", "SUP-", 3)


def get_next_customer_code(db: Session) -> str:
    return get_next_sequence_number(db, "CUSTOMER", "CUS-", 3)


def get_next_invoice_number(db: Session) -> str:
    return get_next_sequence_number(db, "INVOICE", "INV-", 5)


def get_next_purchase_number(db: Session) -> str:
    return get_next_sequence_number(db, "PURCHASE", "PUR-", 5)


def get_next_customer_payment_number(db: Session) -> str:
    return get_next_sequence_number(db, "CUSTOMER_PAYMENT", "CPAY-", 5)


def get_next_supplier_payment_number(db: Session) -> str:
    return get_next_sequence_number(db, "SUPPLIER_PAYMENT", "SPAY-", 5)
