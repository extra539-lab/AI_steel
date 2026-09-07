from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    id = Column(Integer, primary_key=True, index=True)
    sequence_type = Column(String, unique=True, index=True, nullable=False)
    prefix = Column(String, nullable=False, default="")
    last_number = Column(Integer, nullable=False, default=0)
    padding = Column(Integer, nullable=False, default=5)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
