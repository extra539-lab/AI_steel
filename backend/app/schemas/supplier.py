from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class SupplierBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: float = 0.0
    is_active: bool = True


class SupplierCreate(SupplierBase):
    supplier_code: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: Optional[float] = None
    is_active: Optional[bool] = None


class SupplierResponse(SupplierBase):
    id: int
    supplier_code: str
    current_balance: float = 0.0
    total_purchases: float = 0.0
    total_paid: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SupplierLedgerEntry(BaseModel):
    date: datetime
    type: str  # "PURCHASE", "PAYMENT", "OPENING_BALANCE"
    reference: Optional[str] = None
    debit: float = 0.0  # Paid to supplier (reduces payable)
    credit: float = 0.0  # Purchased from supplier (increases payable)
    balance: float = 0.0  # Running payable balance
    notes: Optional[str] = None


class SupplierLedgerResponse(BaseModel):
    supplier: SupplierResponse
    entries: List[SupplierLedgerEntry]
    total_credit: float
    total_debit: float
    final_balance: float
