#!/usr/bin/env bash
set -euo pipefail

echo "Setting up A1 Steel & Cement local development environment"

# Backend venv
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "Backend dependencies installed in backend/venv"

# Frontend deps
cd frontend
npm install
cd ..

echo "Frontend dependencies installed"

echo "Setup complete. Start backend: npm run dev:backend, frontend: npm run dev:frontend"
