from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate, ProductStockAdjust
from app.schemas.inventory import InventoryTransactionResponse
from app.services.inventory_service import InventoryService
from app.utils.numbering import get_next_product_code

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=List[ProductResponse])
def list_products(
    category: Optional[str] = Query(None, description="Filter by category: Cement, Steel"),
    search: Optional[str] = Query(None, description="Search by name or code"),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if active_only:
        query = query.filter(Product.is_active == True)
    if category and category.lower() != "all":
        query = query.filter(Product.category.ilike(category))
    if search:
        term = f"%{search}%"
        query = query.filter(Product.name.ilike(term) | Product.product_code.ilike(term))

    return query.order_by(Product.category, Product.name).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductResponse)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    # Auto-assign code if not provided
    product_code = payload.product_code or get_next_product_code(db)

    # Check for duplicate code
    if db.query(Product).filter(Product.product_code == product_code).first():
        raise HTTPException(status_code=400, detail=f"Product code '{product_code}' already exists")

    # Enforce unit by category if not explicitly given
    unit = payload.unit
    if payload.category.lower() == "cement" and not unit:
        unit = "Bag"
    elif payload.category.lower() == "steel" and not unit:
        unit = "KG"

    product = Product(
        product_code=product_code,
        name=payload.name,
        category=payload.category,
        unit=unit or "Bag",
        purchase_price=payload.purchase_price,
        sale_price=payload.sale_price,
        current_stock=payload.current_stock,
        minimum_stock=payload.minimum_stock,
        is_active=payload.is_active,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # If initial stock > 0, log initial inventory transaction
    if payload.current_stock > 0:
        InventoryService.record_transaction(
            db=db,
            product_id=product.id,
            transaction_type="INITIAL_STOCK",
            reference_id="OPENING",
            quantity=payload.current_stock,
            unit_price=payload.purchase_price,
            notes="Opening stock entry",
        )
        db.commit()

    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete
    product.is_active = False
    db.commit()
    return {"message": f"Product '{product.name}' archived successfully"}


@router.post("/{product_id}/adjust-stock", response_model=InventoryTransactionResponse)
def adjust_stock(product_id: int, payload: ProductStockAdjust, db: Session = Depends(get_db)):
    txn = InventoryService.adjust_stock(
        db=db,
        product_id=product_id,
        adjustment_type=payload.adjustment_type,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    product = txn.product
    return InventoryTransactionResponse(
        id=txn.id,
        product_id=txn.product_id,
        product_name=product.name if product else None,
        product_code=product.product_code if product else None,
        category=product.category if product else None,
        unit=product.unit if product else None,
        transaction_type=txn.transaction_type,
        reference_id=txn.reference_id,
        quantity=txn.quantity,
        stock_before=txn.stock_before,
        stock_after=txn.stock_after,
        unit_price=txn.unit_price,
        transaction_date=txn.transaction_date,
        notes=txn.notes,
        created_at=txn.created_at,
    )
