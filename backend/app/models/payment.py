from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class CustomerPayment(Base):
    __tablename__ = "customer_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    payment_method = Column(String, default="Cash")  # "Cash", "Bank Transfer", "Cheque", "Online"
    reference = Column(String, nullable=True)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False, index=True)  # "ACTIVE", "VOIDED"
    void_reason = Column(Text, nullable=True)
    voided_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="payments")
    sale = relationship("Sale")


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True)
    amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    payment_method = Column(String, default="Cash")  # "Cash", "Bank Transfer", "Cheque", "Online"
    reference = Column(String, nullable=True)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False, index=True)  # "ACTIVE", "VOIDED"
    void_reason = Column(Text, nullable=True)
    voided_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="payments")
    purchase = relationship("Purchase")
