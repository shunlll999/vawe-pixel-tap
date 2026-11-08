#!/bin/sh
# Copy only what the game needs at runtime into dist/ (songs & charts come from the gateway now).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir dist
cp -R index.html manifest.webmanifest og-image.png src icons dist/
echo "dist/ ready:" && find dist -type f
