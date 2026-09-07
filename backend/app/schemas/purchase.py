from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    quantity: float
    unit_price: float
    total: float

    model_config = ConfigDict(from_attributes=True)


class PurchaseCreate(BaseModel):
    supplier_id: int
    purchase_date: Optional[datetime] = None
    items: List[PurchaseItemCreate]
    discount: float = 0.0
    paid_amount: float = 0.0
    payment_method: str = "Credit"  # "Cash", "Bank Transfer", "Cheque", "Credit"
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None


class PurchaseVoidRequest(BaseModel):
    void_reason: str = "Supplier return / Cancellation"


class PurchaseResponse(BaseModel):
    id: int
    purchase_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    purchase_date: datetime
    subtotal: float
    discount: float
    total_amount: float
    paid_amount: float
    remaining_amount: float
    payment_method: str
    notes: Optional[str] = None
    status: str = "ACTIVE"  # "ACTIVE", "VOIDED"
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    items: List[PurchaseItemResponse] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
