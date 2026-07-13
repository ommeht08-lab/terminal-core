#!/usr/bin/env bash
# Launches the backend (FastAPI/uvicorn) and frontend (Next.js) together.
# Usage: ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "Starting Quant Finance Model..."
echo ""

cd "$BACKEND_DIR"
if [ -f "venv/bin/activate" ]; then
  echo "Activating backend venv..."
  # shellcheck disable=SC1091
  source venv/bin/activate
else
  echo "No venv/ found in backend/ — using system Python."
  echo "If this fails, run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
fi

uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "Backend  (PID $BACKEND_PID): http://localhost:8000"
echo "Frontend (PID $FRONTEND_PID): http://localhost:3000"
echo "Press Ctrl+C to stop both."
echo ""

wait
