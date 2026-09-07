from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    name: str
    category: str = "Cement"  # "Cement" or "Steel"
    unit: str = "Bag"  # "Bag" or "KG"
    purchase_price: float = 0.0
    sale_price: float = 0.0
    minimum_stock: float = 50.0
    is_active: bool = True


class ProductCreate(ProductBase):
    product_code: Optional[str] = None
    current_stock: float = 0.0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    current_stock: Optional[float] = None
    minimum_stock: Optional[float] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    product_code: str
    current_stock: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductStockAdjust(BaseModel):
    adjustment_type: str  # "IN" or "OUT"
    quantity: float
    notes: Optional[str] = None
