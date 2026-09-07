# A1 Steel & Cement Dealer Management System

A specialized, high-performance desktop business management application designed for single-PC offline operation for steel and cement dealerships.

---

## 🌟 Key Features

1. **Dual Unit Inventory**:
   - Cement materials tracked strictly in **Bags** (Askari, Fauji, Bestway, Cherat, Lucky, Maple Leaf, Pioneer, etc.).
   - Steel rebars & deformed steel tracked strictly in **KG** (Mughal Steel 60 Grade, Amreli Steel, Ittehad Steel Grade 60, MS Deformed Bar Grade 40, etc.).

2. **Automated Customer Ledgers (Receivables)**:
   - Dynamic running balances: `Opening Balance + Total Invoices - Total Payments Received`.
   - Complete date-wise statement with direct payment receipt recording.

3. **Supplier Ledgers (Payables)**:
   - Dynamic running balances: `Opening Balance + Total Purchases - Total Payments Disbursed`.
   - Complete date-wise vendor statement with payment vouchers.

4. **Fast POS & Thermal Receipt Printing**:
   - Stock limits enforced at billing (cannot oversell available stock).
   - Pixel-perfect **80mm** (standard POS) and **58mm** (compact POS) thermal printer receipts.
   - Shows previous customer ledger balance and new outstanding balance on the receipt.

5. **Historical Price Locking**:
   - Future catalog price changes never alter past invoices or purchase records.

6. **Live Business Dashboard**:
   - Real-time KPIs: Today's Sales, Today's Purchases, Total Receivables, Total Payables, Cement Bags on Hand, Steel KG on Hand.
   - Low stock warning alerts.

7. **Profit & Margin Analytics**:
   - Calculates Gross Profit based on Cost of Goods Sold (COGS) and category breakdown.

8. **One-Click Local Backups**:
   - Instant `.db` database snapshots saved to `backups/` directory with one-click restore.

---

## 🚀 Quick Start Guide

### 1. Start the Backend API Server
```bash
npm run dev:backend
# Or directly:
cd backend
./venv/bin/python run.py
```
*API runs on `http://127.0.0.1:8000` (Docs available at `http://127.0.0.1:8000/docs`).*

### 2. Start the Frontend Application
```bash
npm run dev:frontend
# Or directly:
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### 3. Start Electron Desktop Window (Optional)
```bash
npm run dev:electron
```

### 4. Seed / Reset Sample Data

Seeding of demo/sample data is disabled for production delivery. The repository does not automatically populate customers, suppliers, products, or transactions. If you need to load test/sample data for a development environment, use a separate seed script maintained outside of production delivery.

---

## 🧪 Run Automated Verification Tests
```bash
cd backend
./venv/bin/python test_system.py
```

---

## 📁 Architecture Overview

```text
a1-steel-cement/
├── backend/               # FastAPI + SQLAlchemy Backend
│   ├── app/
│   │   ├── core/         # SQLite DB Engine (WAL mode & foreign keys)
│   │   ├── models/       # Product, Supplier, Customer, Sale, Purchase, Payment, Inventory, Setting
│   │   ├── schemas/      # Pydantic Schemas
│   │   ├── routers/      # REST API endpoints
│   │   ├── services/     # Billing, Inventory, Ledger, Report, Backup services
│   │   └── utils/        # Numbering (INV-00001, SUP-001, PRD-001)
│   └── test_system.py    # Automated test suite
│
├── frontend/              # React 18 + Vite + Desktop POS Styling
│   └── src/
## Production / Delivery Notes

- Database location: by default the production database is stored in `~/.local/share/A1SteelCement/data/a1_steel_cement.db`. You may override this by setting `PRODUCTION_DATABASE` in your environment or creating an `APP_DATA_DIR` and pointing `APP_DATA_DIR`.
- If the application detects a database integrity problem at startup it will abort to prevent silent data corruption. Recovery steps:
   1. Check `~/.local/share/A1SteelCement/backups/` for verified backups created by the application.
   2. If a verified backup exists, restore it via the API or copy it to the production DB path and restart. Example restore command (manual):

```bash
# Stop the service
# sudo systemctl stop a1steel.service
# Restore backup (example)
# cp ~/.local/share/A1SteelCement/backups/A1-Steel-Cement-Backup-YYYY-MM-DD-XX.db ~/.local/share/A1SteelCement/data/a1_steel_cement.db
# chown <service-user>:<service-user> ~/.local/share/A1SteelCement/data/a1_steel_cement.db
# sudo systemctl start a1steel.service
```

- If no verified backup is available, a corrupted DB should be examined by a DBA; do not delete the original file unless you have a verified safety copy. The application preserves safety backups under `backups/` when it attempts migrations/restores.

## Deployment Helpers

- Sample `systemd` service file for the backend is available at `deploy/backend.service` — edit paths and `User=` before using.
- A `Dockerfile.backend` is included for containerized deployments.
- Use `setup.sh` to bootstrap a development environment locally.

│       ├── components/   # ThermalReceipt (80mm / 58mm printer view)
│       ├── pages/        # Dashboard, Sales, Purchases, Products, Inventory, Customers, Suppliers, Payments, Reports, Settings
│       └── services/     # Axios API Client
│
├── electron/              # Electron Desktop Container
├── data/                  # SQLite database (a1_steel_cement.db)
└── backups/               # Timestamped .db database backups
```
# A1_steel_and_cement_shop
# A1_steel_and_cement_shop
