#!/bin/bash
set -uo pipefail

if [ $# -ne 2 ]; then
    echo "Usage $0 <root of the encoder> <encoder output file name>"
    exit 1
fi

ROOT="$1"
OUTPUT="$ROOT/$2"
SUBMAGIC="Web MiniDisc Dynamic Encoder"

mkdir -p $(dirname "$OUTPUT")


echo "Creating base file..."
node dist create "$OUTPUT" "$SUBMAGIC" "$ROOT/metadata.json:metadata.json"


if [ -d "$ROOT/dist" ]; then
    echo "Bundling JS files..."
    TOOL="$(pwd)"
    cd "$ROOT/dist"
    node "$TOOL/dist" append "$OUTPUT" "$SUBMAGIC" $(find . -type f)
    cd "$TOOL"
fi

if [ -d "$ROOT/extra" ]; then
    echo "Bundling extra files..."
    TOOL=$(pwd)
    cd "$ROOT/extra"
    node "$TOOL/dist" append "$OUTPUT" "$SUBMAGIC" $(find . -type f)
    cd "$TOOL"
fi

echo "Done."

