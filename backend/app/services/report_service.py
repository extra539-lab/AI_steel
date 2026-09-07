import sqlite3
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.config import settings
from app.models.product import Product
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.sale import Sale, SaleItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.payment import CustomerPayment, SupplierPayment
from app.models.inventory import InventoryTransaction
from app.schemas.sale import SaleResponse, SaleItemResponse
from app.schemas.purchase import PurchaseResponse, PurchaseItemResponse
from app.schemas.product import ProductResponse
from app.schemas.customer import CustomerResponse
from app.schemas.supplier import SupplierResponse
from app.schemas.inventory import StockSummaryItem
from app.schemas.dashboard import DashboardSummary
from app.schemas.report import (
    SalesReportSummary,
    PurchasesReportSummary,
    ProfitReportSummary,
    InventoryReportSummary,
    DatabaseIntegrityReport,
)
from app.services.ledger_service import LedgerService
from app.services.inventory_service import InventoryService
from app.utils.money import quantize_money, quantize_qty, to_decimal


class ReportService:
    @staticmethod
    def get_dashboard_summary(db: Session) -> DashboardSummary:
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())

        # Today's Sales
        today_sales_val = db.query(func.coalesce(func.sum(Sale.total_amount), 0.0)).filter(
            Sale.sale_date >= today_start,
            Sale.sale_date <= today_end,
            Sale.status == "ACTIVE",
        ).scalar()
        today_sales_count = db.query(Sale).filter(
            Sale.sale_date >= today_start,
            Sale.sale_date <= today_end,
            Sale.status == "ACTIVE",
        ).count()

        # Today's Purchases
        today_purchases_val = db.query(func.coalesce(func.sum(Purchase.total_amount), 0.0)).filter(
            Purchase.purchase_date >= today_start,
            Purchase.purchase_date <= today_end,
            Purchase.status == "ACTIVE",
        ).scalar()
        today_purchases_count = db.query(Purchase).filter(
            Purchase.purchase_date >= today_start,
            Purchase.purchase_date <= today_end,
            Purchase.status == "ACTIVE",
        ).count()

        # Receivables & Payables
        customers = db.query(Customer).filter(Customer.is_active == True).all()
        total_receivable = Decimal("0.00")
        for c in customers:
            summary = LedgerService.get_customer_summary(db, c.id)
            total_receivable += to_decimal(summary["current_balance"])

        suppliers = db.query(Supplier).filter(Supplier.is_active == True).all()
        total_payable = Decimal("0.00")
        for s in suppliers:
            summary = LedgerService.get_supplier_summary(db, s.id)
            total_payable += to_decimal(summary["current_balance"])

        # Stock summary
        products = db.query(Product).filter(Product.is_active == True).all()
        cement_bags = Decimal("0.000")
        steel_kg = Decimal("0.000")
        total_stock_value = Decimal("0.00")
        low_stock_products = []

        for p in products:
            stock = quantize_qty(p.current_stock)
            min_stock = quantize_qty(p.minimum_stock)
            val = quantize_money(stock * quantize_money(p.purchase_price))
            total_stock_value += val

            if p.category.lower() == "cement":
                cement_bags += stock
            elif p.category.lower() == "steel":
                steel_kg += stock

            if stock <= min_stock:
                low_stock_products.append(ProductResponse(
                    id=p.id,
                    product_code=p.product_code,
                    name=p.name,
                    category=p.category,
                    unit=p.unit,
                    purchase_price=float(p.purchase_price),
                    sale_price=float(p.sale_price),
                    current_stock=float(p.current_stock),
                    minimum_stock=float(p.minimum_stock),
                    is_active=p.is_active,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                ))

        # Recent 5 Sales
        recent_sales_db = db.query(Sale).filter(Sale.status == "ACTIVE").order_by(desc(Sale.sale_date), desc(Sale.id)).limit(5).all()
        recent_sales = []
        for s in recent_sales_db:
            item_resps = [
                SaleItemResponse(
                    id=i.id,
                    product_id=i.product_id,
                    product_name=i.product.name if i.product else None,
                    product_code=i.product.product_code if i.product else None,
                    category=i.product.category if i.product else None,
                    unit=i.product.unit if i.product else None,
                    quantity=float(i.quantity),
                    unit_price=float(i.unit_price),
                    total=float(i.total),
                    unit_cost=float(i.unit_cost) if i.unit_cost is not None else None,
                    cost_total=float(i.cost_total) if i.cost_total is not None else None,
                ) for i in s.items
            ]
            recent_sales.append(SaleResponse(
                id=s.id,
                invoice_number=s.invoice_number,
                customer_id=s.customer_id,
                customer_name=s.customer.name if s.customer else "Unknown",
                customer_code=s.customer.customer_code if s.customer else "",
                customer_phone=s.customer.phone if s.customer else "",
                customer_address=s.customer.address if s.customer else "",
                sale_date=s.sale_date,
                subtotal=float(s.subtotal),
                discount=float(s.discount),
                total_amount=float(s.total_amount),
                paid_amount=float(s.paid_amount),
                remaining_amount=float(s.remaining_amount),
                payment_method=s.payment_method,
                notes=s.notes,
                status=s.status,
                void_reason=s.void_reason,
                voided_at=s.voided_at,
                items=item_resps,
                created_at=s.created_at,
            ))

        # Recent 5 Purchases
        recent_purchases_db = db.query(Purchase).filter(Purchase.status == "ACTIVE").order_by(desc(Purchase.purchase_date), desc(Purchase.id)).limit(5).all()
        recent_purchases = []
        for p in recent_purchases_db:
            item_resps = [
                PurchaseItemResponse(
                    id=i.id,
                    product_id=i.product_id,
                    product_name=i.product.name if i.product else None,
                    product_code=i.product.product_code if i.product else None,
                    category=i.product.category if i.product else None,
                    unit=i.product.unit if i.product else None,
                    quantity=float(i.quantity),
                    unit_price=float(i.unit_price),
                    total=float(i.total),
                ) for i in p.items
            ]
            recent_purchases.append(PurchaseResponse(
                id=p.id,
                purchase_number=p.purchase_number,
                supplier_id=p.supplier_id,
                supplier_name=p.supplier.name if p.supplier else "Unknown",
                supplier_code=p.supplier.supplier_code if p.supplier else "",
                purchase_date=p.purchase_date,
                subtotal=float(p.subtotal),
                discount=float(p.discount),
                total_amount=float(p.total_amount),
                paid_amount=float(p.paid_amount),
                remaining_amount=float(p.remaining_amount),
                payment_method=p.payment_method,
                notes=p.notes,
                status=p.status,
                void_reason=p.void_reason,
                voided_at=p.voided_at,
                items=item_resps,
                created_at=p.created_at,
            ))

        return DashboardSummary(
            today_sales_amount=float(quantize_money(today_sales_val)),
            today_sales_count=today_sales_count,
            today_purchases_amount=float(quantize_money(today_purchases_val)),
            today_purchases_count=today_purchases_count,
            total_receivable=float(quantize_money(total_receivable)),
            total_payable=float(quantize_money(total_payable)),
            cement_stock_bags=float(quantize_qty(cement_bags)),
            steel_stock_kg=float(quantize_qty(steel_kg)),
            total_stock_value=float(quantize_money(total_stock_value)),
            low_stock_count=len(low_stock_products),
            total_customers=len(customers),
            total_suppliers=len(suppliers),
            recent_sales=recent_sales,
            recent_purchases=recent_purchases,
            low_stock_products=low_stock_products,
            top_outstanding_customers=[],
            top_outstanding_suppliers=[],
        )

    @staticmethod
    def get_sales_report(
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        customer_id: Optional[int] = None,
    ) -> SalesReportSummary:
        query = db.query(Sale).filter(Sale.status == "ACTIVE")
        if start_date:
            query = query.filter(Sale.sale_date >= start_date)
        if end_date:
            query = query.filter(Sale.sale_date <= end_date)
        if customer_id:
            query = query.filter(Sale.customer_id == customer_id)

        sales_db = query.order_by(desc(Sale.sale_date), desc(Sale.id)).all()

        total_sales = Decimal("0.00")
        total_discount = Decimal("0.00")
        net_sales = Decimal("0.00")
        total_paid = Decimal("0.00")
        total_remaining = Decimal("0.00")
        sales_list = []

        for s in sales_db:
            total_sales += quantize_money(s.subtotal)
            total_discount += quantize_money(s.discount)
            net_sales += quantize_money(s.total_amount)
            total_paid += quantize_money(s.paid_amount)
            total_remaining += quantize_money(s.remaining_amount)

            item_responses = []
            for item in s.items:
                item_responses.append(SaleItemResponse(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product.name if item.product else None,
                    product_code=item.product.product_code if item.product else None,
                    category=item.product.category if item.product else None,
                    unit=item.product.unit if item.product else None,
                    quantity=float(item.quantity),
                    unit_price=float(item.unit_price),
                    total=float(item.total),
                    unit_cost=float(item.unit_cost) if item.unit_cost is not None else None,
                    cost_total=float(item.cost_total) if item.cost_total is not None else None,
                ))

            sales_list.append(SaleResponse(
                id=s.id,
                invoice_number=s.invoice_number,
                customer_id=s.customer_id,
                customer_name=s.customer.name if s.customer else "Unknown",
                customer_code=s.customer.customer_code if s.customer else "",
                customer_phone=s.customer.phone if s.customer else "",
                customer_address=s.customer.address if s.customer else "",
                sale_date=s.sale_date,
                subtotal=float(s.subtotal),
                discount=float(s.discount),
                total_amount=float(s.total_amount),
                paid_amount=float(s.paid_amount),
                remaining_amount=float(s.remaining_amount),
                payment_method=s.payment_method,
                notes=s.notes,
                status=s.status,
                void_reason=s.void_reason,
                voided_at=s.voided_at,
                items=item_responses,
                created_at=s.created_at,
            ))

        return SalesReportSummary(
            total_sales=float(total_sales),
            total_discount=float(total_discount),
            net_sales=float(net_sales),
            total_paid=float(total_paid),
            total_remaining=float(total_remaining),
            count=len(sales_list),
            sales=sales_list,
        )

    @staticmethod
    def get_purchases_report(
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        supplier_id: Optional[int] = None,
    ) -> PurchasesReportSummary:
        query = db.query(Purchase).filter(Purchase.status == "ACTIVE")
        if start_date:
            query = query.filter(Purchase.purchase_date >= start_date)
        if end_date:
            query = query.filter(Purchase.purchase_date <= end_date)
        if supplier_id:
            query = query.filter(Purchase.supplier_id == supplier_id)

        purchases_db = query.order_by(desc(Purchase.purchase_date), desc(Purchase.id)).all()

        total_purchases = Decimal("0.00")
        total_discount = Decimal("0.00")
        net_purchases = Decimal("0.00")
        total_paid = Decimal("0.00")
        total_remaining = Decimal("0.00")
        purchases_list = []

        for p in purchases_db:
            total_purchases += quantize_money(p.subtotal)
            total_discount += quantize_money(p.discount)
            net_purchases += quantize_money(p.total_amount)
            total_paid += quantize_money(p.paid_amount)
            total_remaining += quantize_money(p.remaining_amount)

            item_responses = []
            for item in p.items:
                item_responses.append(PurchaseItemResponse(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product.name if item.product else None,
                    product_code=item.product.product_code if item.product else None,
                    category=item.product.category if item.product else None,
                    unit=item.product.unit if item.product else None,
                    quantity=float(item.quantity),
                    unit_price=float(item.unit_price),
                    total=float(item.total),
                ))

            purchases_list.append(PurchaseResponse(
                id=p.id,
                purchase_number=p.purchase_number,
                supplier_id=p.supplier_id,
                supplier_name=p.supplier.name if p.supplier else "Unknown",
                supplier_code=p.supplier.supplier_code if p.supplier else "",
                purchase_date=p.purchase_date,
                subtotal=float(p.subtotal),
                discount=float(p.discount),
                total_amount=float(p.total_amount),
                paid_amount=float(p.paid_amount),
                remaining_amount=float(p.remaining_amount),
                payment_method=p.payment_method,
                notes=p.notes,
                status=p.status,
                void_reason=p.void_reason,
                voided_at=p.voided_at,
                items=item_responses,
                created_at=p.created_at,
            ))

        return PurchasesReportSummary(
            total_purchases=float(total_purchases),
            total_discount=float(total_discount),
            net_purchases=float(net_purchases),
            total_paid=float(total_paid),
            total_remaining=float(total_remaining),
            count=len(purchases_list),
            purchases=purchases_list,
        )

    @staticmethod
    def get_inventory_report(db: Session, category: Optional[str] = None) -> InventoryReportSummary:
        query = db.query(Product).filter(Product.is_active == True)
        if category and category.lower() != "all":
            query = query.filter(Product.category.ilike(category))

        products = query.order_by(Product.category, Product.name).all()

        total_cement_bags = Decimal("0.000")
        total_steel_kg = Decimal("0.000")
        total_valuation = Decimal("0.00")
        low_stock_count = 0
        items: List[StockSummaryItem] = []

        for p in products:
            stock = quantize_qty(p.current_stock)
            min_stock = quantize_qty(p.minimum_stock)
            buy_price = quantize_money(p.purchase_price)
            val = quantize_money(stock * buy_price)

            if p.category.lower() == "cement":
                total_cement_bags += stock
            elif p.category.lower() == "steel":
                total_steel_kg += stock

            total_valuation += val

            status = "IN_STOCK"
            if stock <= Decimal("0.000"):
                status = "OUT_OF_STOCK"
                low_stock_count += 1
            elif stock <= min_stock:
                status = "LOW_STOCK"
                low_stock_count += 1

            items.append(StockSummaryItem(
                product_id=p.id,
                product_code=p.product_code,
                product_name=p.name,
                category=p.category,
                unit=p.unit,
                current_stock=float(stock),
                minimum_stock=float(min_stock),
                purchase_price=float(buy_price),
                sale_price=float(p.sale_price),
                stock_value=float(val),
                status=status,
            ))

        return InventoryReportSummary(
            total_products=len(products),
            total_cement_bags=float(total_cement_bags),
            total_steel_kg=float(total_steel_kg),
            total_valuation=float(total_valuation),
            low_stock_count=low_stock_count,
            items=items,
        )

    @staticmethod
    def get_profit_report(
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> ProfitReportSummary:
        query = db.query(Sale).filter(Sale.status == "ACTIVE")
        if start_date:
            query = query.filter(Sale.sale_date >= start_date)
        if end_date:
            query = query.filter(Sale.sale_date <= end_date)

        sales = query.all()

        total_revenue = Decimal("0.00")
        total_cogs = Decimal("0.00")
        cement_rev = Decimal("0.00")
        steel_rev = Decimal("0.00")

        for s in sales:
            total_revenue += quantize_money(s.total_amount)
            for item in s.items:
                # Use permanently stored historical cost
                if item.cost_total is not None:
                    item_cogs = quantize_money(item.cost_total)
                elif item.unit_cost is not None:
                    item_cogs = quantize_money(quantize_qty(item.quantity) * quantize_money(item.unit_cost))
                else:
                    # Fallback to historical purchase/stock rate
                    item_cogs = quantize_money(quantize_qty(item.quantity) * quantize_money(item.product.purchase_price if item.product else 0.0))

                total_cogs += item_cogs

                if item.product and item.product.category.lower() == "cement":
                    cement_rev += quantize_money(item.total)
                elif item.product and item.product.category.lower() == "steel":
                    steel_rev += quantize_money(item.total)

        gross_profit = quantize_money(total_revenue - total_cogs)
        margin_pct = (gross_profit / total_revenue * Decimal("100.0")) if total_revenue > Decimal("0.00") else Decimal("0.00")

        return ProfitReportSummary(
            total_sales_revenue=float(total_revenue),
            total_cost_of_goods_sold=float(total_cogs),
            gross_profit=float(gross_profit),
            profit_margin_percent=round(float(margin_pct), 2),
            total_sales_count=len(sales),
            cement_revenue=float(cement_rev),
            steel_revenue=float(steel_rev),
        )

    @staticmethod
    def audit_database_integrity(db: Session) -> DatabaseIntegrityReport:
        details = []

        # 1. SQLite integrity_check & foreign_key_check
        conn = db.connection().connection
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        sqlite_integrity = str(cursor.fetchall())
        cursor.execute("PRAGMA foreign_key_check;")
        fk_errors = cursor.fetchall()
        fk_status = "OK" if not fk_errors else f"Foreign key errors: {fk_errors}"

        # 2. Orphaned items
        orphaned_sale_items = db.query(SaleItem).filter(~SaleItem.sale_id.in_(db.query(Sale.id))).count()
        orphaned_purchase_items = db.query(PurchaseItem).filter(~PurchaseItem.purchase_id.in_(db.query(Purchase.id))).count()
        orphaned_customer_payments = db.query(CustomerPayment).filter(
            CustomerPayment.sale_id.isnot(None),
            ~CustomerPayment.sale_id.in_(db.query(Sale.id)),
        ).count()
        orphaned_supplier_payments = db.query(SupplierPayment).filter(
            SupplierPayment.purchase_id.isnot(None),
            ~SupplierPayment.purchase_id.in_(db.query(Purchase.id)),
        ).count()

        if orphaned_sale_items:
            details.append(f"Found {orphaned_sale_items} orphaned sale items")
        if orphaned_purchase_items:
            details.append(f"Found {orphaned_purchase_items} orphaned purchase items")

        # 3. Customer Ledger Discrepancies
        cust_discrepancies = 0
        for c in db.query(Customer).all():
            summary = LedgerService.get_customer_summary(db, c.id)
            total_sales_calc = db.query(func.coalesce(func.sum(Sale.total_amount), 0.0)).filter(
                Sale.customer_id == c.id, Sale.status == "ACTIVE"
            ).scalar()
            total_paid_calc = db.query(func.coalesce(func.sum(CustomerPayment.amount), 0.0)).filter(
                CustomerPayment.customer_id == c.id, CustomerPayment.status == "ACTIVE"
            ).scalar()
            expected_bal = quantize_money(c.opening_balance or 0.0) + quantize_money(total_sales_calc) - quantize_money(total_paid_calc)
            if abs(expected_bal - to_decimal(summary["current_balance"])) > Decimal("0.01"):
                cust_discrepancies += 1
                details.append(f"Customer #{c.customer_code} balance discrepancy: recorded {summary['current_balance']}, expected {expected_bal}")

        # 4. Supplier Ledger Discrepancies
        sup_discrepancies = 0
        for s in db.query(Supplier).all():
            summary = LedgerService.get_supplier_summary(db, s.id)
            total_pur_calc = db.query(func.coalesce(func.sum(Purchase.total_amount), 0.0)).filter(
                Purchase.supplier_id == s.id, Purchase.status == "ACTIVE"
            ).scalar()
            total_paid_calc = db.query(func.coalesce(func.sum(SupplierPayment.amount), 0.0)).filter(
                SupplierPayment.supplier_id == s.id, SupplierPayment.status == "ACTIVE"
            ).scalar()
            expected_bal = quantize_money(s.opening_balance or 0.0) + quantize_money(total_pur_calc) - quantize_money(total_paid_calc)
            if abs(expected_bal - to_decimal(summary["current_balance"])) > Decimal("0.01"):
                sup_discrepancies += 1
                details.append(f"Supplier #{s.supplier_code} balance discrepancy: recorded {summary['current_balance']}, expected {expected_bal}")

        # 5. Inventory Reconciliation
        inv_rec = InventoryService.reconcile_inventory(db)
        inv_discrepancies = inv_rec.discrepant_products
        if inv_discrepancies > 0:
            for item in inv_rec.items:
                if not item.is_balanced:
                    details.append(f"Product {item.product_code} stock discrepancy: current {item.recorded_stock}, audit {item.calculated_stock}")

        is_healthy = (
            "ok" in sqlite_integrity.lower()
            and fk_status == "OK"
            and orphaned_sale_items == 0
            and orphaned_purchase_items == 0
            and cust_discrepancies == 0
            and sup_discrepancies == 0
            and inv_discrepancies == 0
        )

        return DatabaseIntegrityReport(
            status="HEALTHY" if is_healthy else "DISCREPANCY_FOUND",
            sqlite_integrity=sqlite_integrity,
            foreign_keys_status=fk_status,
            orphaned_sale_items=orphaned_sale_items,
            orphaned_purchase_items=orphaned_purchase_items,
            orphaned_customer_payments=orphaned_customer_payments,
            orphaned_supplier_payments=orphaned_supplier_payments,
            customer_ledger_discrepancies=cust_discrepancies,
            supplier_ledger_discrepancies=sup_discrepancies,
            inventory_discrepancies=inv_discrepancies,
            details=details,
        )
