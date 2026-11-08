#!/bin/sh
set -e
cd "$(dirname "$0")"
echo "Open http://localhost:5173 in a browser"
python3 -m http.server 5173
