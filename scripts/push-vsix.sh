#!/bin/bash

set -e

# Find the latest modelharbor VSIX file in bin/
LATEST_VSIX=$(ls -t bin/modelharbor-*.vsix | head -1)

if [ -z "$LATEST_VSIX" ]; then
    echo "Error: No modelharbor VSIX files found in bin/"
    exit 1
fi

echo "Found latest VSIX: $LATEST_VSIX"

# Extract version from filename (e.g., modelharbor-agent-3.20.2.vsix)
if [[ "$LATEST_VSIX" =~ ([0-9]+\.[0-9]+\.[0-9]+) ]]; then
    VERSION="${BASH_REMATCH[1]}"
    echo "Extracted version from filename: $VERSION"
else
    echo "Error: Could not extract version from filename: $LATEST_VSIX"
    exit 1
fi

# Unzip VSIX to temp dir
TMPDIR=$(mktemp -d)
unzip -q "$LATEST_VSIX" -d "$TMPDIR"

PKG_JSON="$TMPDIR/extension/package.json"

if [ ! -f "$PKG_JSON" ]; then
    echo "Error: package.json not found in VSIX"
    rm -rf "$TMPDIR"
    exit 1
fi

# Check if version is present in package.json
HAS_VERSION=$(jq -r '.version // empty' "$PKG_JSON")

if [ -z "$HAS_VERSION" ]; then
    echo "Manifest missing version. Injecting version $VERSION into package.json"
    jq --arg v "$VERSION" '.version = $v' "$PKG_JSON" > "$PKG_JSON.tmp" && mv "$PKG_JSON.tmp" "$PKG_JSON"
    # Repack VSIX
    NEW_VSIX="${LATEST_VSIX%.vsix}-fixed.vsix"
    (cd "$TMPDIR" && zip -qr "../$(basename "$NEW_VSIX")" .)
    VSIX_TO_PUBLISH="$NEW_VSIX"
    echo "Created fixed VSIX: $VSIX_TO_PUBLISH"
else
    VSIX_TO_PUBLISH="$LATEST_VSIX"
    echo "Manifest already has version: $HAS_VERSION"
fi

# Publish to VS Code marketplace
vsce publish -p "$VSCE_PAT" --packagePath "$VSIX_TO_PUBLISH"

if [ $? -eq 0 ]; then
    echo "Successfully published $VSIX_TO_PUBLISH to VS Code marketplace"
else
    echo "Error publishing VSIX"
    rm -rf "$TMPDIR"
    exit 1
fi

rm -rf "$TMPDIR"