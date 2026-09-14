#!/usr/bin/env bash
# ==============================================================================
# CraftOrbit — Automated Linux & Ubuntu Server Setup
# ==============================================================================

set -e

echo ""
echo "  🪐 ============================================"
echo "     CraftOrbit Setup (Linux / Ubuntu Server)"
echo "  ================================================"
echo ""

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js not found."
    echo "    Please install Node.js (v18+) first:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VER=$(node -v)
echo "[✓] Node.js detected: ${NODE_VER}"

# 2. Check Java
if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -n 1)
    echo "[✓] Java detected: ${JAVA_VER}"
else
    echo "[!] Notice: Java is not in PATH. CraftOrbit can scan /usr/lib/jvm"
    echo "    Recommended for modern Minecraft:"
    echo "    sudo apt update && sudo apt install -y openjdk-21-jre-headless"
fi

# 3. Install NPM Dependencies
echo ""
echo "[*] Installing CraftOrbit Node.js dependencies..."
npm install --production

# 4. Make Launcher Executable
chmod +x start.sh 2>/dev/null || true

echo ""
echo "=================================================="
echo "  [✓] Setup completed successfully!"
echo ""
echo "  To start CraftOrbit directly in terminal:"
echo "    ./start.sh"
echo ""
echo "  To run as a 24/7 background service on Ubuntu:"
echo "    sudo cp craftorbit.service /etc/systemd/system/"
echo "    sudo systemctl daemon-reload"
echo "    sudo systemctl enable --now craftorbit"
echo "=================================================="
echo ""
