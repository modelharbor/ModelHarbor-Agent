#!/bin/bash
# Installs the latest version of the modelharbor-agent .vsix from bin/ using VSCode CLI

set -e
pnpm build
pnpm vsix
# Find the latest .vsix file by version
LATEST_VSIX=$(ls bin/modelharbor-agent-*.vsix 2>/dev/null | sort -V | tail -n 1)

if [ -z "$LATEST_VSIX" ]; then
  echo "No .vsix files found in bin/"
  exit 1
fi

echo "Installing extension: $LATEST_VSIX"
code --install-extension "$LATEST_VSIX"