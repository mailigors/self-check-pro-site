#!/usr/bin/env python3
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://selfcheck.pro'
NS = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
errors = []


def fail(message):
    errors.append(message)


def source_for_url(url):
    route = urlparse(url).path.strip('/')
    if not route:
        return ROOT / 'index.html'
    if route == 'en':
        return ROOT / 'en/index.html'
    parts = route.split('/')
    if parts[0] == 'en':
        return ROOT / 'en' / f'{parts[-1]}.html'
    return ROOT / f'{parts[-1]}.html'


tree = ET.parse(ROOT / 'sitemap.xml')
entries = tree.findall('sm:url', NS)
urls = []
for entry in entries:
    loc = entry.findtext('sm:loc', default='', namespaces=NS)
    lastmod = entry.findtext('sm:lastmod', default='', namespaces=NS)
    if not loc.startswith(SITE + '/'):
        fail(f'sitemap: URL вне основного домена: {loc}')
    if loc != SITE + '/' and not loc.endswith('/'):
        fail(f'sitemap: URL каталога должен оканчиваться на /: {loc}')
    try:
        parsed_date = date.fromisoformat(lastmod)
        if parsed_date > date.today():
            fail(f'sitemap: lastmod находится в будущем: {loc}')
    except ValueError:
        fail(f'sitemap: неверный lastmod для {loc}: {lastmod}')
    urls.append(loc)

if len(urls) != len(set(urls)):
    fail('sitemap: найдены повторяющиеся URL')

titles = {}
descriptions = {}
for url in urls:
    path = source_for_url(url)
    if not path.is_file():
        fail(f'нет исходного HTML для {url}: {path.relative_to(ROOT)}')
        continue
    text = path.read_text(encoding='utf-8')
    rel = path.relative_to(ROOT)

    def one(pattern, label):
        matches = re.findall(pattern, text, re.S)
        if len(matches) != 1:
            fail(f'{rel}: ожидался один {label}, найдено {len(matches)}')
            return ''
        return unescape(matches[0].strip())

    title = one(r'<title>(.*?)</title>', 'title')
    description = one(r'<meta name="description" content="(.*?)">', 'meta description')
    canonical = one(r'<link rel="canonical" href="(.*?)">', 'canonical')
    og_url = one(r'<meta property="og:url" content="(.*?)">', 'og:url')
    if canonical != url:
        fail(f'{rel}: canonical {canonical!r} не совпадает с sitemap URL {url!r}')
    if og_url != canonical:
        fail(f'{rel}: og:url должен совпадать с canonical')

    for value, label, registry in ((title, 'title', titles), (description, 'description', descriptions)):
        if not value:
            continue
        if value in registry:
            fail(f'{rel}: {label} повторяет {registry[value]}')
        registry[value] = rel

    alternate_pairs = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', text)
    alternates = dict(alternate_pairs)
    if len(alternate_pairs) != 3:
        fail(f'{rel}: ожидалось ровно три hreflang-ссылки, найдено {len(alternate_pairs)}')
    if set(alternates) != {'ru-RU', 'en', 'x-default'}:
        fail(f'{rel}: нужен полный набор hreflang ru-RU, en, x-default')
    if url.startswith(SITE + '/en/'):
        ru_url = SITE + urlparse(url).path.removeprefix('/en')
        en_url = url
    else:
        ru_url = url
        en_url = SITE + '/en/' + urlparse(url).path.strip('/') + '/'
        if url == SITE + '/':
            en_url = SITE + '/en/'
    if alternates.get('ru-RU') != ru_url or alternates.get('en') != en_url or alternates.get('x-default') != ru_url:
        fail(f'{rel}: hreflang-ссылки не взаимны или ведут не на canonical URL')

    schema_raw = one(r'<script type="application/ld\+json">(.*?)</script>', 'JSON-LD block')
    if schema_raw:
        try:
            schema = json.loads(schema_raw)
            types = {node.get('@type') for node in schema.get('@graph', [])}
            required = {'Organization', 'WebSite', 'SoftwareApplication', 'WebPage'}
            if not required.issubset(types):
                fail(f'{rel}: JSON-LD не содержит {sorted(required - types)}')
            if url not in (SITE + '/', SITE + '/en/') and 'BreadcrumbList' not in types:
                fail(f'{rel}: для внутренней страницы нужен BreadcrumbList')
        except (json.JSONDecodeError, AttributeError) as exc:
            fail(f'{rel}: JSON-LD не разбирается: {exc}')

    if re.search(r'href="/(?:en/)?(?:horeca|uk|posutochno|klining|policy|consent)"', text):
        fail(f'{rel}: внутренняя ссылка на каталог должна оканчиваться на /')

for legal in ('policy.html', 'consent.html', 'en/policy.html', 'en/consent.html'):
    text = (ROOT / legal).read_text(encoding='utf-8')
    if '<meta name="robots" content="noindex">' not in text:
        fail(f'{legal}: юридическая страница должна оставаться noindex')

if errors:
    for error in errors:
        print(f'ERROR SEO: {error}', file=sys.stderr)
    sys.exit(1)

print(f'SEO-проверка пройдена: {len(urls)} индексируемых страниц.')
