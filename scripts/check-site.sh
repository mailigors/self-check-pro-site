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
  en/index.html
  en/horeca.html
  en/uk.html
  en/posutochno.html
  en/klining.html
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

  clean_path="${path%/}"
  if [[ "$clean_path" == "/en" ]]; then
    html_file="en/index.html"
  else
    html_file="${clean_path#/}.html"
  fi
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

for page in index horeca uk posutochno klining; do
  html_file="dist/en/index.html"
  [[ "$page" != "index" ]] && html_file="dist/en/$page/index.html"
  if [[ ! -f "$html_file" ]]; then
    fail "после сборки отсутствует английская страница: $html_file"
  fi
  if ! rg -q '<html lang="en">' "$html_file"; then
    fail "английская страница не помечена lang=en: $html_file"
  fi
  if ! rg -q 'class="lang-switch"' "$html_file"; then
    fail "на английской странице нет переключателя языка: $html_file"
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

for page in index horeca uk posutochno klining; do
  html_file="dist/en/index.html"
  [[ "$page" != "index" ]] && html_file="dist/en/$page/index.html"
  if ! rg -q 'data-endpoint="/api/lead"' "$html_file"; then
    fail "в английской VDS-сборке не включена форма: $html_file"
  fi
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
