from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.sale import SaleResponse
from app.schemas.purchase import PurchaseResponse
from app.schemas.inventory import StockSummaryItem


class SalesReportSummary(BaseModel):
    total_sales: float = 0.0
    total_discount: float = 0.0
    net_sales: float = 0.0
    total_paid: float = 0.0
    total_remaining: float = 0.0
    count: int = 0
    sales: List[SaleResponse] = []


class PurchasesReportSummary(BaseModel):
    total_purchases: float = 0.0
    total_discount: float = 0.0
    net_purchases: float = 0.0
    total_paid: float = 0.0
    total_remaining: float = 0.0
    count: int = 0
    purchases: List[PurchaseResponse] = []


class ProfitReportSummary(BaseModel):
    total_sales_revenue: float = 0.0
    total_cost_of_goods_sold: float = 0.0
    gross_profit: float = 0.0
    profit_margin_percent: float = 0.0
    total_sales_count: int = 0
    cement_revenue: float = 0.0
    steel_revenue: float = 0.0


class InventoryReportSummary(BaseModel):
    total_products: int = 0
    total_cement_bags: float = 0.0
    total_steel_kg: float = 0.0
    total_valuation: float = 0.0
    low_stock_count: int = 0
    items: List[StockSummaryItem] = []


class BackupInfo(BaseModel):
    filename: str
    file_size_kb: float
    created_at: str
    is_verified: bool = True
    tables_count: int = 0


class BackupHealthInfo(BaseModel):
    status: str  # "HEALTHY", "WARNING", "ERROR"
    last_successful_backup: Optional[str] = None
    last_verified_backup: Optional[str] = None
    last_backup_timestamp: Optional[str] = None
    destinations: List[str] = []
    total_backups_count: int = 0
    is_verified: bool = True


class DatabaseIntegrityReport(BaseModel):
    status: str  # "HEALTHY" or "DISCREPANCY_FOUND"
    sqlite_integrity: str
    foreign_keys_status: str
    orphaned_sale_items: int = 0
    orphaned_purchase_items: int = 0
    orphaned_customer_payments: int = 0
    orphaned_supplier_payments: int = 0
    customer_ledger_discrepancies: int = 0
    supplier_ledger_discrepancies: int = 0
    inventory_discrepancies: int = 0
    details: List[str] = []
