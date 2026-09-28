#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

failures=0

fail() {
  echo "ERROR: $*" >&2
  failures=$((failures + 1))
}

require_file() {
  if [[ ! -f "$1" ]]; then
    fail "отсутствует обязательный файл: $1"
  fi
}

echo "==> Проверка обязательных файлов"
REQUIRED_FILES=(
  index.html
  horeca.html
  uk.html
  posutochno.html
  klining.html
  policy.html
  consent.html
  assets/styles.css
  assets/friends/ginza-project.png
  assets/friends/krivets-ptitsa.png
  robots.txt
  sitemap.xml
  logo.png
  og.png
  favicon-32.png
  apple-touch-icon.png
)

for file in "${REQUIRED_FILES[@]}"; do
  require_file "$file"
done

echo "==> Проверка sitemap.xml"
if ! xmllint --noout sitemap.xml; then
  fail "sitemap.xml не прошёл XML-валидацию"
fi

while IFS= read -r loc; do
  path="${loc#https://selfcheck.pro}"
  [[ -z "$path" || "$path" == "/" ]] && continue

  html_file="${path#/}.html"
  if [[ ! -f "$html_file" ]]; then
    fail "в sitemap указан путь $path, но файл $html_file не найден"
  fi
done < <(xmllint --xpath '//*[local-name()="loc"]/text()' sitemap.xml 2>/dev/null | tr ' ' '\n' | sed '/^$/d')

echo "==> Сборка для GitHub Pages"
if ! bash scripts/prepare-pages.sh; then
  fail "scripts/prepare-pages.sh завершился с ошибкой"
fi

for page in horeca uk posutochno klining policy consent; do
  if [[ ! -f "dist/$page/index.html" ]]; then
    fail "после сборки отсутствует dist/$page/index.html"
  fi
done

if rg -q 'data-endpoint="/api/lead"' dist/index.html; then
  fail "форма не должна включаться в публичном превью без серверного API"
fi

echo "==> Сборка для Selectel VDS"
if ! BASE_PATH=/ LEAD_ENDPOINT=/api/lead bash scripts/prepare-pages.sh; then
  fail "сборка для Selectel VDS завершилась с ошибкой"
fi

for page in index horeca uk posutochno klining; do
  html_file="dist/index.html"
  [[ "$page" != "index" ]] && html_file="dist/$page/index.html"
  if ! rg -q 'data-endpoint="/api/lead"' "$html_file"; then
    fail "в VDS-сборке не включена форма: $html_file"
  fi
  for field in email comment; do
    if ! rg -q "name=\"$field\"" "$html_file"; then
      fail "в форме отсутствует поле $field: $html_file"
    fi
  done
done

if ! rg -q '/assets/lead-form\.[0-9a-f]{12}\.js' dist/index.html; then
  fail "JavaScript формы должен иметь версию по содержимому для сброса кэша"
fi

if ! rg -q '/assets/styles\.[0-9a-f]{12}\.css' dist/index.html; then
  fail "CSS должен иметь версию по содержимому для сброса кэша"
fi

if [[ "$(find assets/friends -type f -name '*.png' | wc -l | tr -d ' ')" != "24" ]]; then
  fail "в блоке «Наши друзья» должно быть 24 PNG-логотипа"
fi

if [[ "$(find dist/assets/friends -type f -name '*.png' | wc -l | tr -d ' ')" != "24" ]]; then
  fail "в сборку GitHub Pages попали не все логотипы"
fi

echo "==> Поиск случайно закоммиченных секретов"
if rg -n --pcre2 '(?i)(bot[0-9]{8,}:[A-Za-z0-9_-]{20,}|TELEGRAM_(BOT_TOKEN|CHAT_ID)\s*=\s*[^[:space:]#]+|api[_-]?key\s*=\s*[^[:space:]#]+)' \
  --glob '!scripts/check-site.sh' \
  --glob '!README.md' \
  --glob '!.github/**' \
  . >/tmp/selfcheck-secrets.txt 2>/dev/null; then
  cat /tmp/selfcheck-secrets.txt >&2
  fail "найдены потенциальные секреты в репозитории"
fi

if [[ "$failures" -gt 0 ]]; then
  echo
  echo "Проверка завершилась с ошибками: $failures"
  exit 1
fi

echo "Проверка пройдена успешно."
