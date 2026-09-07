from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: float = 0.0
    is_active: bool = True


class CustomerCreate(CustomerBase):
    customer_code: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: Optional[float] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    customer_code: str
    current_balance: float = 0.0
    total_sales: float = 0.0
    total_paid: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerLedgerEntry(BaseModel):
    date: datetime
    type: str  # "SALE", "PAYMENT", "OPENING_BALANCE"
    reference: Optional[str] = None
    debit: float = 0.0  # Sale to customer (increases receivable)
    credit: float = 0.0  # Payment from customer (decreases receivable)
    balance: float = 0.0  # Running receivable balance
    notes: Optional[str] = None


class CustomerLedgerResponse(BaseModel):
    customer: CustomerResponse
    entries: List[CustomerLedgerEntry]
    total_debit: float
    total_credit: float
    final_balance: float
