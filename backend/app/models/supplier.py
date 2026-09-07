from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    opening_balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)  # Initial payable balance
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchases = relationship("Purchase", back_populates="supplier", cascade="all, delete-orphan")
    payments = relationship("SupplierPayment", back_populates="supplier", cascade="all, delete-orphan")
