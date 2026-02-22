#!/bin/bash

# Script to run linting and capture output
set -e

echo "=== Step 1: Running pnpm install ==="
pnpm install 2>&1

echo ""
echo "=== Step 2: Running pnpm lint ==="
pnpm lint 2>&1 || true

echo ""
echo "=== Lint check complete ==="