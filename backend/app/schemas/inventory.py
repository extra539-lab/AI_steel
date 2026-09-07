from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class InventoryTransactionResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    transaction_type: str
    reference_id: Optional[str] = None
    quantity: float
    stock_before: float
    stock_after: float
    unit_price: float
    transaction_date: datetime
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StockSummaryItem(BaseModel):
    product_id: int
    product_code: str
    product_name: str
    category: str
    unit: str
    current_stock: float
    minimum_stock: float
    purchase_price: float
    sale_price: float
    stock_value: float  # current_stock * purchase_price
    status: str  # "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"

    model_config = ConfigDict(from_attributes=True)


class InventoryReconciliationItem(BaseModel):
    product_id: int
    product_code: str
    product_name: str
    category: str
    unit: str
    recorded_stock: float
    calculated_stock: float
    discrepancy: float
    is_balanced: bool

    model_config = ConfigDict(from_attributes=True)


class InventoryReconciliationReport(BaseModel):
    total_products: int
    balanced_products: int
    discrepant_products: int
    is_reconciled: bool
    items: List[InventoryReconciliationItem]
