from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.supplier import Supplier
from app.schemas.supplier import (
    SupplierCreate,
    SupplierResponse,
    SupplierUpdate,
    SupplierLedgerResponse,
)
from app.services.ledger_service import LedgerService
from app.utils.numbering import get_next_supplier_code

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name, code, or phone"),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Supplier)
    if active_only:
        query = query.filter(Supplier.is_active == True)
    if search:
        term = f"%{search}%"
        query = query.filter(
            Supplier.name.ilike(term) | Supplier.supplier_code.ilike(term) | Supplier.phone.ilike(term)
        )

    suppliers = query.order_by(Supplier.name).all()
    results = []
    for s in suppliers:
        summary = LedgerService.get_supplier_summary(db, s.id)
        results.append(SupplierResponse(
            id=s.id,
            supplier_code=s.supplier_code,
            name=s.name,
            phone=s.phone,
            address=s.address,
            opening_balance=s.opening_balance,
            is_active=s.is_active,
            current_balance=summary["current_balance"],
            total_purchases=summary["total_purchases"],
            total_paid=summary["total_paid"],
            created_at=s.created_at,
            updated_at=s.updated_at,
        ))
    return results


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    summary = LedgerService.get_supplier_summary(db, s.id)
    return SupplierResponse(
        id=s.id,
        supplier_code=s.supplier_code,
        name=s.name,
        phone=s.phone,
        address=s.address,
        opening_balance=s.opening_balance,
        is_active=s.is_active,
        current_balance=summary["current_balance"],
        total_purchases=summary["total_purchases"],
        total_paid=summary["total_paid"],
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.post("/", response_model=SupplierResponse)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    code = payload.supplier_code or get_next_supplier_code(db)

    if db.query(Supplier).filter(Supplier.supplier_code == code).first():
        raise HTTPException(status_code=400, detail=f"Supplier code '{code}' already exists")

    supplier = Supplier(
        supplier_code=code,
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
        opening_balance=payload.opening_balance,
        is_active=payload.is_active,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    return SupplierResponse(
        id=supplier.id,
        supplier_code=supplier.supplier_code,
        name=supplier.name,
        phone=supplier.phone,
        address=supplier.address,
        opening_balance=supplier.opening_balance,
        is_active=supplier.is_active,
        current_balance=supplier.opening_balance or 0.0,
        total_purchases=0.0,
        total_paid=0.0,
        created_at=supplier.created_at,
        updated_at=supplier.updated_at,
    )


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(s, field, value)

    db.commit()
    db.refresh(s)

    summary = LedgerService.get_supplier_summary(db, s.id)
    return SupplierResponse(
        id=s.id,
        supplier_code=s.supplier_code,
        name=s.name,
        phone=s.phone,
        address=s.address,
        opening_balance=s.opening_balance,
        is_active=s.is_active,
        current_balance=summary["current_balance"],
        total_purchases=summary["total_purchases"],
        total_paid=summary["total_paid"],
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    s.is_active = False
    db.commit()
    return {"message": f"Supplier '{s.name}' archived successfully"}


@router.get("/{supplier_id}/ledger", response_model=SupplierLedgerResponse)
def get_supplier_ledger(supplier_id: int, db: Session = Depends(get_db)):
    return LedgerService.get_supplier_ledger(db, supplier_id)
