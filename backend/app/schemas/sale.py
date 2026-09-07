from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    quantity: float
    unit_price: float
    total: float
    unit_cost: Optional[float] = None
    cost_total: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class SaleCreate(BaseModel):
    customer_id: int
    sale_date: Optional[datetime] = None
    items: List[SaleItemCreate]
    discount: float = 0.0
    mazdori: float = 0.0
    paid_amount: float = 0.0
    payment_method: str = "Cash"  # "Cash", "Bank Transfer", "Cheque", "Credit"
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None


class SaleVoidRequest(BaseModel):
    void_reason: str = "Customer return / Cancellation"


class SaleResponse(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    sale_date: datetime
    subtotal: float
    discount: float
    mazdori: float
    total_amount: float
    paid_amount: float
    remaining_amount: float
    payment_method: str
    notes: Optional[str] = None
    status: str = "ACTIVE"  # "ACTIVE", "VOIDED"
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    items: List[SaleItemResponse] = []
    customer_previous_balance: float = 0.0
    customer_total_balance: float = 0.0
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
