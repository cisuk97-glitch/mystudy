#!/bin/bash
# ========================================================
# MY SPECIAL ENGLISH - One-Click Launcher for macOS
# ========================================================

cd "$(dirname "$0")"

# Check if server is already running
if ! lsof -i :8089 > /dev/null 2>&1; then
    echo "🚀 Starting MY SPECIAL ENGLISH Local SQLite Server..."
    python3 server.py &
    sleep 1
fi

echo "✨ Opening App..."
open http://localhost:8089
