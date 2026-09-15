#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST/assets"

touch "$DIST/.nojekyll"

cp "$ROOT/index.html" "$DIST/index.html"
cp "$ROOT/assets/styles.css" "$DIST/assets/styles.css"
cp "$ROOT/logo.png" "$ROOT/og.png" "$ROOT/favicon-32.png" "$ROOT/apple-touch-icon.png" "$DIST/"
cp "$ROOT/robots.txt" "$ROOT/sitemap.xml" "$DIST/"

for page in horeca uk posutochno klining policy consent; do
  mkdir -p "$DIST/$page"
  cp "$ROOT/$page.html" "$DIST/$page/index.html"
done

echo "Сборка для GitHub Pages готова: $DIST"
