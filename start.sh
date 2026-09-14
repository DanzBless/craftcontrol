#!/usr/bin/env bash
# ==============================================================================
# CraftOrbit — Web Dashboard & Server Manager Launcher
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

export NODE_ENV=production
export PORT=3000

echo ""
echo "  🪐 ============================================"
echo "     CraftOrbit Web Server Starting..."
echo "     Dashboard: http://localhost:${PORT}"
echo "  ================================================"
echo ""

exec node server.js
