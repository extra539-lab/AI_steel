from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    sale_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    subtotal = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    discount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    mazdori = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    paid_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    remaining_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    payment_method = Column(String, default="Cash")  # "Cash", "Bank Transfer", "Cheque", "Credit"
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False, index=True)  # "ACTIVE", "VOIDED"
    void_reason = Column(Text, nullable=True)
    voided_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(15, 3), default=Decimal("0.000"), nullable=False)
    unit_price = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    unit_cost = Column(Numeric(15, 2), nullable=True)  # Historical unit cost at the exact time of sale
    cost_total = Column(Numeric(15, 2), nullable=True)  # Historical total cost (quantity * unit_cost)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
