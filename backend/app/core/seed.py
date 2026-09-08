from typing import List
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models import Product


DEFAULT_PRODUCTS = {
    "Cement": [
        {"name": "Cherat Cement", "unit": "Bag"},
        {"name": "Lucky Cement", "unit": "Bag"},
        {"name": "Askari Cement", "unit": "Bag"},
        {"name": "kohat", "unit": "Bag"},
    ],
    "Steel": [
        {"name": "1/2 Steel", "unit": "KG"},
        {"name": "1/4 Steel", "unit": "KG"},
        {"name": "5/8 Steel", "unit": "KG"},
        {"name": "6/8 Steel", "unit": "KG"},
        {"name": "buidingwire", "unit": "KG"},
    ],
    "Other Materials": [
        {"name": "Wheelbarrow", "unit": "PCS"},
        {"name": "Tyre", "unit": "PCS"},
        {"name": "Tube", "unit": "PCS"},
        {"name": "Rim", "unit": "PCS"},
        {"name": "Plastic", "unit": "PCS"},
    ],
}


def _normalize_code(name: str) -> str:
    # create a stable product_code from name
    code = name.strip().lower().replace(" ", "_").replace("/", "_").replace("-", "_")
    return f"seed_{code}"


def ensure_default_products(db: Session) -> List[str]:
    """Insert default categories/products idempotently. Returns list of created product_codes."""
    created: List[str] = []
    updated = False

    for category, items in DEFAULT_PRODUCTS.items():
        for item in items:
            name = item.get("name")
            unit = item.get("unit", "PCS")
            product_code = _normalize_code(name)

            existing = db.query(Product).filter(Product.product_code == product_code).first()
            if existing:
                # ensure category/unit match existing record - do not overwrite prices or stock
                if existing.category != category or existing.unit != unit:
                    existing.category = category
                    existing.unit = unit
                    db.add(existing)
                    updated = True
                continue

            p = Product(
                product_code=product_code,
                name=name,
                category=category,
                unit=unit,
                purchase_price=Decimal("0.00"),
                sale_price=Decimal("0.00"),
                current_stock=Decimal("0.000"),
                minimum_stock=Decimal("0.000"),
                is_active=True,
            )
            db.add(p)
            created.append(product_code)

    if created:
        db.commit()

    # commit updates (category/unit changes) as well
    if updated and not created:
        db.commit()

    return created
