from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    purchase_number = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    subtotal = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    discount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    paid_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    remaining_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    payment_method = Column(String, default="Credit")  # "Cash", "Bank Transfer", "Cheque", "Credit"
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False, index=True)  # "ACTIVE", "VOIDED"
    void_reason = Column(Text, nullable=True)
    voided_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(15, 3), default=Decimal("0.000"), nullable=False)
    unit_price = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")
