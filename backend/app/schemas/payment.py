from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CustomerPaymentCreate(BaseModel):
    customer_id: int
    amount: float
    payment_method: str = "Cash"  # "Cash", "Bank Transfer", "Cheque", "Online"
    reference: Optional[str] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None
    sale_id: Optional[int] = None
    idempotency_key: Optional[str] = None


class CustomerPaymentVoidRequest(BaseModel):
    void_reason: str = "Duplicate / Error entry"


class CustomerPaymentResponse(BaseModel):
    id: int
    payment_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    sale_id: Optional[int] = None
    amount: float
    payment_method: str
    reference: Optional[str] = None
    payment_date: datetime
    notes: Optional[str] = None
    status: str = "ACTIVE"  # "ACTIVE", "VOIDED"
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SupplierPaymentCreate(BaseModel):
    supplier_id: int
    amount: float
    payment_method: str = "Cash"  # "Cash", "Bank Transfer", "Cheque", "Online"
    reference: Optional[str] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None
    purchase_id: Optional[int] = None
    idempotency_key: Optional[str] = None


class SupplierPaymentVoidRequest(BaseModel):
    void_reason: str = "Duplicate / Error entry"


class SupplierPaymentResponse(BaseModel):
    id: int
    payment_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    purchase_id: Optional[int] = None
    amount: float
    payment_method: str
    reference: Optional[str] = None
    payment_date: datetime
    notes: Optional[str] = None
    status: str = "ACTIVE"  # "ACTIVE", "VOIDED"
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
