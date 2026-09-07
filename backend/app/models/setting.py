from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime

from app.core.database import Base


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    # Neutral defaults: avoid shipping demo/contact text so a fresh install
    # starts with a clean/empty configuration for the customer to fill.
    business_name = Column(String, default="")
    tagline = Column(String, default="")
    phone = Column(String, default="")
    address = Column(Text, default="")
    invoice_footer = Column(Text, default="")
    # Keep printer type sensible since this affects layout; leave as 80mm.
    printer_type = Column(String, default="80mm")  # "80mm" or "58mm"
    # Currency symbol can be configured by the user; leave empty by default.
    currency_symbol = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
