#!/usr/bin/env bash
set -euo pipefail

ARCHIVE=/tmp/selfcheck-pro-deploy.tgz
DEPLOY_ROOT=/var/www/selfcheck-deployments
APP_ROOT=$DEPLOY_ROOT/current
NEXT_ROOT=$DEPLOY_ROOT/next
PREVIOUS_ROOT=$DEPLOY_ROOT/previous

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Deployment archive is missing" >&2
  exit 1
fi
rm -rf "$NEXT_ROOT"
install -d -m 0755 "$NEXT_ROOT"
tar -xzf "$ARCHIVE" -C "$NEXT_ROOT"

cd "$NEXT_ROOT"
/usr/local/bin/npm test
/usr/local/bin/npm run build

rm -rf "$PREVIOUS_ROOT"
if [[ -d "$APP_ROOT" ]]; then
  mv "$APP_ROOT" "$PREVIOUS_ROOT"
fi
mv "$NEXT_ROOT" "$APP_ROOT"

pid=$(pgrep -u "$(id -u)" -f '^/usr/local/bin/node server\.mjs$' || true)
if [[ -n "$pid" ]]; then
  kill -TERM "$pid"
fi

healthy=false
for _ in {1..10}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/healthz >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != true ]]; then
  echo "Health check failed, rolling back" >&2
  rm -rf "$NEXT_ROOT"
  rm -rf "$NEXT_ROOT.failed"
  mv "$APP_ROOT" "$NEXT_ROOT.failed"
  if [[ -d "$PREVIOUS_ROOT" ]]; then
    mv "$PREVIOUS_ROOT" "$APP_ROOT"
    pid=$(pgrep -u "$(id -u)" -f '^/usr/local/bin/node server\.mjs$' || true)
    if [[ -n "$pid" ]]; then
      kill -TERM "$pid"
    fi
  fi
  exit 1
fi

rm -f "$ARCHIVE"
echo "SelfCheck Pro deployed successfully"
