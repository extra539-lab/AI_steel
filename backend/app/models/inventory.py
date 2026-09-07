from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    transaction_type = Column(String, nullable=False, index=True)  # "PURCHASE", "SALE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "SALE_VOID", "PURCHASE_VOID", "INITIAL_STOCK"
    reference_id = Column(String, nullable=True, index=True)  # e.g., "INV-00001", "PUR-00001", "ADJ-001"
    quantity = Column(Numeric(15, 3), nullable=False, default=Decimal("0.000"))
    stock_before = Column(Numeric(15, 3), nullable=False, default=Decimal("0.000"))
    stock_after = Column(Numeric(15, 3), nullable=False, default=Decimal("0.000"))
    unit_price = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    transaction_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
