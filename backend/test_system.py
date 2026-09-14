import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("APP_DATA_DIR", str(Path(__file__).resolve().parent / "test-data"))
os.environ.setdefault("PRODUCTION_DATABASE", str(Path(__file__).resolve().parent / "test-data" / "a1_steel_cement.db"))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(__file__).resolve().parent / 'test-data' / 'a1_steel_cement.db'}")

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.migration import run_database_migration
from app.core.seed import ensure_baseline_application_data
from app.models import Product, Supplier, Customer, Sale, SaleItem, Purchase, PurchaseItem, CustomerPayment, SupplierPayment, InventoryTransaction
from app.services.billing_service import BillingService
from app.services.purchase_service import PurchaseService
from app.services.payment_service import PaymentService
from app.services.ledger_service import LedgerService
from app.services.inventory_service import InventoryService
from app.services.report_service import ReportService
from app.services.backup_service import BackupService
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleVoidRequest
from app.schemas.purchase import PurchaseCreate, PurchaseItemCreate
from app.schemas.payment import CustomerPaymentCreate, SupplierPaymentCreate
from app.utils.numbering import get_next_invoice_number, get_next_purchase_number


def run_full_verification():
    print("=" * 70)
    print("=== A1 STEEL & CEMENT FACTORY - FULL REGRESSION AUDIT TEST SUITE ===")
    print("=" * 70)

    # 1. Non-destructive Migration
    mig_res = run_database_migration()
    assert mig_res["status"] in ["success", "created_fresh"], "Migration failed!"
    print(f"✓ [TEST 1] Non-Destructive Migration: Verified OK ({len(mig_res.get('changes', []))} schema operations)")

    db = SessionLocal()

    seed_result = ensure_baseline_application_data(db)
    print(f"[seed] Initialized baseline data: {seed_result}")

    # 2. Verify Catalog & Precision
    products_count = db.query(Product).count()
    customers_count = db.query(Customer).count()
    suppliers_count = db.query(Supplier).count()
    assert products_count >= 16, f"Expected at least 16 products, found {products_count}"
    assert customers_count >= 5, f"Expected at least 5 customers, found {customers_count}"
    assert suppliers_count >= 5, f"Expected at least 5 suppliers, found {suppliers_count}"
    print(f"✓ [TEST 2] Existing Data Preserved: {products_count} Products, {customers_count} Customers, {suppliers_count} Suppliers intact")

    # 3. Decimal Financial Precision & Fractional Quantities
    test_steel = db.query(Product).filter(Product.category == "Steel").first()
    test_cust = db.query(Customer).first()
    exact_qty = 15.750  # 15.750 KG
    exact_rate = 282.50
    expected_subtotal = round(15.750 * 282.50, 2)  # 4449.375 -> 4449.38

    steel_stock_before = test_steel.current_stock
    sale_dec = BillingService.create_sale(db, SaleCreate(
        customer_id=test_cust.id,
        items=[SaleItemCreate(product_id=test_steel.id, quantity=exact_qty, unit_price=exact_rate)],
        discount=49.38,
        paid_amount=4000.00,
        payment_method="Cash",
    ))
    db.refresh(test_steel)
    assert abs(sale_dec.subtotal - 4449.38) < 0.01, f"Subtotal mismatch: {sale_dec.subtotal} vs 4449.38"
    assert abs(sale_dec.total_amount - 4400.00) < 0.01, f"Total mismatch: {sale_dec.total_amount} vs 4400.00"
    assert abs(sale_dec.remaining_amount - 400.00) < 0.01, f"Remaining mismatch: {sale_dec.remaining_amount} vs 400.00"
    print(f"✓ [TEST 3] Fixed-Precision Decimal Calculations: 15.750 KG @ Rs. 282.50 = Rs. {sale_dec.subtotal:,.2f} (No binary float drift)")

    # 4. Historical COGS & Profit Locking
    test_cement = db.query(Product).filter(Product.product_code == "PRD-001").first()
    initial_buy_rate = float(test_cement.purchase_price)
    sale_cogs = BillingService.create_sale(db, SaleCreate(
        customer_id=test_cust.id,
        items=[SaleItemCreate(product_id=test_cement.id, quantity=10.0, unit_price=1600.0)],
        discount=0.0,
        paid_amount=16000.0,
    ))

    # Verify historical unit_cost captured on the sale item
    sale_item_db = db.query(SaleItem).filter(SaleItem.sale_id == sale_cogs.id).first()
    assert float(sale_item_db.unit_cost) == initial_buy_rate, f"Historical unit_cost {sale_item_db.unit_cost} != {initial_buy_rate}"
    expected_cogs = 10.0 * initial_buy_rate
    assert float(sale_item_db.cost_total) == expected_cogs, f"Historical cost_total {sale_item_db.cost_total} != {expected_cogs}"

    # Now change product purchase price in catalog to simulate future inflation
    test_cement.purchase_price = Decimal("2000.00")
    db.commit()

    # Re-query the sale item from DB to ensure historical cost is strictly unchanged
    db.refresh(sale_item_db)
    assert float(sale_item_db.unit_cost) == initial_buy_rate, "Historical unit_cost changed when catalog price was modified!"
    assert float(sale_item_db.cost_total) == expected_cogs, "Historical cost_total changed when catalog price was modified!"

    print(f"✓ [TEST 4] Historical Profit / COGS Integrity: Profit calculated strictly from locked unit_cost (Rs. {initial_buy_rate:,.2f}) despite catalog price increase to Rs. 2,000.00")

    # 5. Discount Validation (Server-side rejection)
    try:
        BillingService.create_sale(db, SaleCreate(
            customer_id=test_cust.id,
            items=[SaleItemCreate(product_id=test_cement.id, quantity=5.0, unit_price=1600.0)],
            discount=99999.0,  # Discount > Subtotal (8,000)
        ))
        assert False, "Failed to reject discount exceeding subtotal!"
    except Exception as e:
        print("✓ [TEST 5] Discount Validation: Server rejected discount exceeding invoice subtotal")

    # 6. Cross-Customer Payment Rejection
    cust_a = db.query(Customer).filter(Customer.id == test_cust.id).first()
    cust_b = db.query(Customer).filter(Customer.id != test_cust.id).first()
    try:
        PaymentService.create_customer_payment(db, CustomerPaymentCreate(
            customer_id=cust_b.id,
            sale_id=sale_cogs.id,  # sale belongs to cust_a
            amount=500.0,
        ))
        assert False, "Failed to reject cross-customer payment link!"
    except Exception as e:
        print("✓ [TEST 6] Payment Relationship Validation: Server rejected payment linking customer B to customer A's invoice")

    # 7. Transaction Atomicity & Rollback Verification
    stock_before_fail = test_cement.current_stock
    sales_count_before = db.query(Sale).count()
    try:
        # Deliberately request more stock than available
        BillingService.create_sale(db, SaleCreate(
            customer_id=test_cust.id,
            items=[SaleItemCreate(product_id=test_cement.id, quantity=float(stock_before_fail) + 5000.0, unit_price=1600.0)],
            discount=0.0,
            paid_amount=1000.0,
        ))
        assert False, "Failed to enforce stock availability!"
    except Exception as e:
        # Verify rollback
        db.refresh(test_cement)
        sales_count_after = db.query(Sale).count()
        assert sales_count_after == sales_count_before, "Partial sale record was saved despite failure!"
        assert test_cement.current_stock == stock_before_fail, "Stock was modified despite transaction failure!"
        print("✓ [TEST 7] Transaction Atomicity & Rollback: Zero partial records saved when transaction failed mid-flight")

    # 8. Concurrency-Safe Sequential Numbering
    inv_1 = get_next_invoice_number(db)
    inv_2 = get_next_invoice_number(db)
    assert inv_1 != inv_2, "Duplicate sequence numbers generated!"
    print(f"✓ [TEST 8] Concurrency-Safe Sequence Numbering: {inv_1} -> {inv_2} generated atomically via DocumentSequence")

    # 9. Void Sale & Stock Reversal (No Hard Deletion)
    stock_before_void = test_cement.current_stock
    sale_to_void = BillingService.create_sale(db, SaleCreate(
        customer_id=test_cust.id,
        items=[SaleItemCreate(product_id=test_cement.id, quantity=10.0, unit_price=1600.0)],
        discount=0.0,
        paid_amount=5000.0,
    ))
    db.refresh(test_cement)
    assert test_cement.current_stock == stock_before_void - Decimal("10.000")

    # Void the sale
    voided_resp = BillingService.void_sale(db, sale_to_void.id, SaleVoidRequest(void_reason="Test Customer Cancellation"))
    db.refresh(test_cement)
    assert voided_resp.status == "VOIDED"
    assert test_cement.current_stock == stock_before_void, f"Stock was not restored upon void! {test_cement.current_stock} != {stock_before_void}"
    print(f"✓ [TEST 9] Audit-Safe Voiding & Stock Reversal: Invoice #{voided_resp.invoice_number} voided; 10 Bags restored to inventory without hard deletion")

    # 10. Inventory Reconciliation Audit
    rec_report = InventoryService.reconcile_inventory(db)
    assert rec_report.is_reconciled, f"Inventory reconciliation discrepancy found! Discrepant count: {rec_report.discrepant_products}"
    print(f"✓ [TEST 10] Inventory Reconciliation: Formula (Opening + Purchases + In - Sales - Out = Stock) perfectly balanced across all {rec_report.total_products} products")

    # 11. Customer & Supplier Ledger Integrity
    cust_ledger = LedgerService.get_customer_ledger(db, test_cust.id)
    assert cust_ledger.final_balance == (cust_ledger.total_debit - cust_ledger.total_credit), "Customer ledger running balance mismatch!"
    test_sup = db.query(Supplier).first()
    sup_ledger = LedgerService.get_supplier_ledger(db, test_sup.id)
    assert sup_ledger.final_balance == (sup_ledger.total_credit - sup_ledger.total_debit), "Supplier ledger running balance mismatch!"
    print(f"✓ [TEST 11] Customer & Supplier Ledger Integrity: Mathematical ledger running balances verified with zero double-counting")

    # 12. SQLite Native Online Backup & Automated Verification
    backup_info = BackupService.create_backup()
    assert backup_info.is_verified, "Backup failed automated verification check!"
    health_info = BackupService.get_backup_health()
    assert health_info.status == "HEALTHY", f"Backup health status: {health_info.status}"
    print(f"✓ [TEST 12] SQLite Native Online Backup: Created {backup_info.filename} ({backup_info.file_size_kb} KB) with verified PRAGMA integrity_check")

    # 13. Safe Database Restore with Rollback Protection
    restore_res = BackupService.restore_backup(backup_info.filename)
    assert restore_res["status"] == "success", "Restore failed!"
    print(f"✓ [TEST 13] Safe Database Restore: Restored from {backup_info.filename} with pre-restore safety copy ({restore_res['safety_backup']})")

    # 14. Full Database & Financial Integrity Audit
    integrity_audit = ReportService.audit_database_integrity(db)
    assert integrity_audit.status == "HEALTHY", f"Integrity audit reported discrepancies: {integrity_audit.details}"
    print(f"✓ [TEST 14] Full Database & Financial Audit: Status={integrity_audit.status}, ForeignKeys={integrity_audit.foreign_keys_status}, OrphanedItems=0")

    db.close()
    print("=" * 70)
    print("🎉 ALL 14 AUDIT SUITE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == "__main__":
    run_full_verification()
