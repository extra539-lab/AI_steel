from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    opening_balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)  # Initial receivable balance
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sales = relationship("Sale", back_populates="customer", cascade="all, delete-orphan")
    payments = relationship("CustomerPayment", back_populates="customer", cascade="all, delete-orphan")
