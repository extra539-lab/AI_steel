from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.product import Product
from app.models.inventory import InventoryTransaction
from app.schemas.inventory import (
    InventoryReconciliationItem,
    InventoryReconciliationReport,
)
from app.utils.money import quantize_qty, quantize_money, to_decimal, money_to_float


class InventoryService:
    @staticmethod
    def record_transaction(
        db: Session,
        product_id: int,
        transaction_type: str,
        reference_id: str,
        quantity: Any,
        unit_price: Any = 0.0,
        notes: Optional[str] = None,
        transaction_date: Optional[datetime] = None,
    ) -> InventoryTransaction:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with ID {product_id} not found")

        qty_dec = quantize_qty(quantity)
        price_dec = quantize_money(unit_price)

        stock_before = quantize_qty(product.current_stock)
        stock_after = quantize_qty(stock_before + qty_dec)

        # Prevent negative stock on deductions
        if stock_after < Decimal("0.000") and transaction_type in ["SALE", "ADJUSTMENT_OUT", "PURCHASE_VOID"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}'. Available: {stock_before} {product.unit}, Requested: {abs(qty_dec)} {product.unit}",
            )

        product.current_stock = stock_after

        txn = InventoryTransaction(
            product_id=product_id,
            transaction_type=transaction_type,
            reference_id=reference_id,
            quantity=qty_dec,
            stock_before=stock_before,
            stock_after=stock_after,
            unit_price=price_dec,
            transaction_date=transaction_date or datetime.utcnow(),
            notes=notes,
        )
        db.add(txn)
        return txn

    @staticmethod
    def adjust_stock(
        db: Session,
        product_id: int,
        adjustment_type: str,
        quantity: Any,
        notes: Optional[str] = None,
    ) -> InventoryTransaction:
        qty_dec = quantize_qty(quantity)
        if qty_dec <= Decimal("0.000"):
            raise HTTPException(status_code=400, detail="Adjustment quantity must be greater than zero")

        qty_delta = qty_dec if adjustment_type.upper() == "IN" else -qty_dec
        txn_type = "ADJUSTMENT_IN" if adjustment_type.upper() == "IN" else "ADJUSTMENT_OUT"

        txn = InventoryService.record_transaction(
            db=db,
            product_id=product_id,
            transaction_type=txn_type,
            reference_id="MANUAL-ADJUST",
            quantity=qty_delta,
            notes=notes or f"Manual stock adjustment ({adjustment_type.upper()})",
        )
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def get_product_history(db: Session, product_id: int, limit: int = 100) -> List[InventoryTransaction]:
        return (
            db.query(InventoryTransaction)
            .filter(InventoryTransaction.product_id == product_id)
            .order_by(desc(InventoryTransaction.transaction_date), desc(InventoryTransaction.id))
            .limit(limit)
            .all()
        )

    @staticmethod
    def reconcile_inventory(db: Session) -> InventoryReconciliationReport:
        products = db.query(Product).order_by(Product.category, Product.name).all()
        items: List[InventoryReconciliationItem] = []
        balanced_count = 0
        discrepancy_count = 0

        for p in products:
            rec_stock = quantize_qty(p.current_stock)
            # Sum all transactions
            total_calc = db.query(func.coalesce(func.sum(InventoryTransaction.quantity), 0.0)).filter(
                InventoryTransaction.product_id == p.id
            ).scalar()
            calc_stock = quantize_qty(total_calc)
            discrepancy = quantize_qty(rec_stock - calc_stock)
            is_balanced = abs(discrepancy) < Decimal("0.001")

            if is_balanced:
                balanced_count += 1
            else:
                discrepancy_count += 1

            items.append(InventoryReconciliationItem(
                product_id=p.id,
                product_code=p.product_code,
                product_name=p.name,
                category=p.category,
                unit=p.unit,
                recorded_stock=float(rec_stock),
                calculated_stock=float(calc_stock),
                discrepancy=float(discrepancy),
                is_balanced=is_balanced,
            ))

        return InventoryReconciliationReport(
            total_products=len(products),
            balanced_products=balanced_count,
            discrepant_products=discrepancy_count,
            is_reconciled=(discrepancy_count == 0),
            items=items,
        )
