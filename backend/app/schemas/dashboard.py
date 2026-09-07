from typing import List
from pydantic import BaseModel
from app.schemas.product import ProductResponse
from app.schemas.sale import SaleResponse
from app.schemas.purchase import PurchaseResponse
from app.schemas.customer import CustomerResponse
from app.schemas.supplier import SupplierResponse


class DashboardSummary(BaseModel):
    today_sales_amount: float = 0.0
    today_sales_count: int = 0
    today_purchases_amount: float = 0.0
    today_purchases_count: int = 0
    total_receivable: float = 0.0
    total_payable: float = 0.0
    cement_stock_bags: float = 0.0
    steel_stock_kg: float = 0.0
    total_stock_value: float = 0.0
    low_stock_count: int = 0
    total_customers: int = 0
    total_suppliers: int = 0
    recent_sales: List[SaleResponse] = []
    recent_purchases: List[PurchaseResponse] = []
    low_stock_products: List[ProductResponse] = []
    top_outstanding_customers: List[CustomerResponse] = []
    top_outstanding_suppliers: List[SupplierResponse] = []
