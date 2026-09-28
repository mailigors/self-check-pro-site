#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

if [[ -z "${BASE_PATH:-}" ]]; then
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    repo_name="${GITHUB_REPOSITORY##*/}"
    if [[ "$repo_name" == *.github.io ]]; then
      BASE_PATH="/"
    else
      BASE_PATH="/$repo_name"
    fi
  else
    BASE_PATH="/self-check-pro-site"
  fi
fi

rm -rf "$DIST"
mkdir -p "$DIST/assets"

touch "$DIST/.nojekyll"

cp "$ROOT/index.html" "$DIST/index.html"
cp "$ROOT/assets/styles.css" "$DIST/assets/styles.css"
cp "$ROOT/assets/lead-form.js" "$DIST/assets/lead-form.js"
cp -R "$ROOT/assets/friends" "$DIST/assets/friends"
cp "$ROOT/logo.png" "$ROOT/og.png" "$ROOT/favicon-32.png" "$ROOT/apple-touch-icon.png" "$DIST/"
cp "$ROOT/robots.txt" "$ROOT/sitemap.xml" "$DIST/"

for page in horeca uk posutochno klining policy consent; do
  mkdir -p "$DIST/$page"
  cp "$ROOT/$page.html" "$DIST/$page/index.html"
done

BASE_PATH="$BASE_PATH" DIST="$DIST" python3 - <<'PY'
import os
import re
from pathlib import Path

base = os.environ["BASE_PATH"].rstrip("/")
lead_endpoint = os.environ.get("LEAD_ENDPOINT", "")
dist = Path(os.environ["DIST"])

pattern = re.compile(r'(?P<prefix>(?:href|src)=")/(?!/)')

for html in dist.rglob("*.html"):
    text = html.read_text(encoding="utf-8")
    if base and base != "/":
        text = pattern.sub(rf'\g<prefix>{base}/', text)
    if lead_endpoint:
        text = text.replace('data-endpoint=""', f'data-endpoint="{lead_endpoint}"')
    html.write_text(text, encoding="utf-8")
PY

echo "Сборка сайта готова: $DIST (BASE_PATH=${BASE_PATH}, LEAD_ENDPOINT=${LEAD_ENDPOINT:-disabled})"
