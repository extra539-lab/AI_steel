from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # e.g., "SALE", "PURCHASE", "PAYMENT", "STOCK", "BACKUP", "RESTORE"
    entity_id = Column(String, nullable=True, index=True)    # e.g., "INV-00001", "123"
    action = Column(String, nullable=False)                  # e.g., "CREATE", "UPDATE", "VOID", "RESTORE", "ADJUST"
    user = Column(String, nullable=False, default="owner")
    details = Column(Text, nullable=True)                    # JSON or descriptive text of changes
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
