from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, default="Cement")  # "Cement" or "Steel"
    unit = Column(String, nullable=False, default="Bag")  # "Bag" or "KG"
    purchase_price = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    sale_price = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    current_stock = Column(Numeric(15, 3), default=Decimal("0.000"), nullable=False)
    minimum_stock = Column(Numeric(15, 3), default=Decimal("50.000"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
