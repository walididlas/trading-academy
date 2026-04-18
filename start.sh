#!/usr/bin/env bash
# ── Trading Academy — one-command start ───────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

echo ""
echo "  ██████╗ ██████╗  █████╗ ██████╗ ██╗███╗  ██╗ ██████╗"
echo "  ╚══██╔╝ ██╔══██╗██╔══██╗██╔══██╗██║████╗ ██║██╔════╝"
echo "     ██║  ██████╔╝███████║██║  ██║██║██╔██╗██║██║  ███╗"
echo "     ██║  ██╔══██╗██╔══██║██║  ██║██║██║╚████║██║   ██║"
echo "     ██║  ██║  ██║██║  ██║██████╔╝██║██║ ╚███║╚██████╔╝"
echo "     ╚═╝  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚══╝ ╚═════╝"
echo "  Trading Academy — ICC Kill Zone Method"
echo ""

# ── 1. Frontend deps ───────────────────────────────────────────────────────────
echo "▶ Installing frontend dependencies..."
cd "$FRONTEND"
npm install --silent

# ── 2. Backend virtual env ─────────────────────────────────────────────────────
echo "▶ Setting up Python backend..."
cd "$BACKEND"

if [ ! -d "venv" ]; then
  echo "  Creating virtualenv..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

# Copy .env.example to .env if not present
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "  ⚠️  Created backend/.env — add your ANTHROPIC_API_KEY to enable AI chat"
  echo "      Edit: $BACKEND/.env"
  echo ""
fi

# ── 3. Launch both servers ─────────────────────────────────────────────────────
echo "▶ Starting backend (FastAPI on :8000)..."
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "▶ Starting frontend (Vite on :5173)..."
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✅ Trading Academy is running!"
echo "  → Open: http://localhost:5173"
echo "  → Backend: http://localhost:8000/api/health"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

# ── Wait and clean up ──────────────────────────────────────────────────────────
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
