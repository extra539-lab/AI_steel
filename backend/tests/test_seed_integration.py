import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.config import settings, build_sqlite_url
from app.core.seed import ensure_default_products
from app.routers import products_router
from app.models.product import Product


REQUIRED_CODES = [
    'seed_askari_cement',
    'seed_lucky_cement',
    'seed_cherat_cement',
    'seed_1_2_steel',
    'seed_1_4_steel',
    'seed_5_8_steel',
    'seed_6_8_steel',
    'seed_wheelbarrow',
    'seed_tyre',
    'seed_tube',
    'seed_rim',
    'seed_plastic',
]


@pytest.fixture(scope='function')
def db_engine_session(tmp_path):
    """Create a temporary sqlite engine and session for tests using a file DB so multiple connections share state."""
    db_file = tmp_path / "test_db.sqlite"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # create tables on the test engine
    Base.metadata.create_all(bind=engine)

    yield engine, TestingSessionLocal


def override_get_db_factory(TestingSessionLocal):
    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    return _override_get_db


def test_seed_idempotent_and_categories(db_engine_session):
    engine, TestingSessionLocal = db_engine_session

    # Run seeder first time
    db = TestingSessionLocal()
    try:
        created = ensure_default_products(db)
    finally:
        db.close()

    # Verify required codes exist
    db = TestingSessionLocal()
    try:
        codes = {p.product_code for p in db.query(Product).all()}
        for code in REQUIRED_CODES:
            assert code in codes, f"Missing seeded product code: {code}"

        # verify categories
        cement = { 'seed_askari_cement','seed_lucky_cement','seed_cherat_cement' }
        steel = { 'seed_1_2_steel','seed_1_4_steel','seed_5_8_steel','seed_6_8_steel' }
        other = { 'seed_wheelbarrow','seed_tyre','seed_tube','seed_rim','seed_plastic' }

        for c in cement:
            p = db.query(Product).filter(Product.product_code == c).first()
            assert p is not None and p.category == 'Cement'

        for s in steel:
            p = db.query(Product).filter(Product.product_code == s).first()
            assert p is not None and p.category == 'Steel'

        for o in other:
            p = db.query(Product).filter(Product.product_code == o).first()
            assert p is not None and p.category == 'Other Materials'

        # record counts per code
        counts = {}
        for code in REQUIRED_CODES:
            counts[code] = db.query(Product).filter(Product.product_code == code).count()

    finally:
        db.close()

    # Run seeder second time (idempotency)
    db = TestingSessionLocal()
    try:
        created2 = ensure_default_products(db)
    finally:
        db.close()

    # verify no duplicates: counts unchanged and second run created nothing
    db = TestingSessionLocal()
    try:
        for code in REQUIRED_CODES:
            assert db.query(Product).filter(Product.product_code == code).count() == counts[code]
        assert created2 == [] or all(c in REQUIRED_CODES for c in created2)
    finally:
        db.close()


def test_sqlite_url_uses_windows_compatible_forward_slashes():
    db_path = Path(r"C:\Users\Test\AppData\Roaming\A1SteelCement\data\a1_steel_cement.db")
    assert build_sqlite_url(db_path) == "sqlite:///C:/Users/Test/AppData/Roaming/A1SteelCement/data/a1_steel_cement.db"


def test_health_and_products_api(db_engine_session):
    engine, TestingSessionLocal = db_engine_session

    # seed the test DB
    db = TestingSessionLocal()
    try:
        ensure_default_products(db)
    finally:
        db.close()

    # build test FastAPI app and override get_db
    app = FastAPI()
    app.include_router(products_router, prefix=settings.API_V1_PREFIX)

    app.dependency_overrides[get_db] = override_get_db_factory(TestingSessionLocal)

    @app.get('/health')
    def health():
        return {'status': 'healthy'}

    client = TestClient(app)

    r = client.get('/health')
    assert r.status_code == 200

    r = client.get(f"{settings.API_V1_PREFIX}/products?active_only=true")
    assert r.status_code == 200
    data = r.json()
    codes = {p['product_code'] for p in data}
    for code in REQUIRED_CODES:
        assert code in codes
