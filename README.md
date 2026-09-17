# SelfCheck Pro — сайт

Исходники сайта для совместной доработки внутри команды.
Репозиторий: https://github.com/mailigors/self-check-pro-site

Статический HTML/CSS и JavaScript без сборки и зависимостей в исходниках. Публикация и проверки настроены через GitHub Actions; сайт выкладывается на GitHub Pages.

## Структура

| Файл | Назначение |
| --- | --- |
| `index.html` | Главная |
| `horeca.html` | Кафе, рестораны и бары |
| `uk.html` | Управляющие компании |
| `posutochno.html` | Посуточная аренда |
| `klining.html` | Клининговые компании |
| `policy.html`, `consent.html` | Юридические страницы с незаполненными реквизитами |
| `assets/styles.css` | Общие стили |
| `logo.png`, `og.png`, `favicon-32.png`, `apple-touch-icon.png` | Графика |
| `robots.txt`, `sitemap.xml` | Индексация |
| `.github/workflows/` | CI и деплой на GitHub Pages |
| `scripts/check-site.sh` | Локальная и CI-проверка структуры сайта |
| `scripts/prepare-pages.sh` | Сборка каталога `dist/` для GitHub Pages |

## Локальный просмотр

Из корня репозитория:

```sh
python3 -m http.server 8000
```

Открыть http://localhost:8000. На простом файловом сервере отраслевые и юридические страницы доступны с расширением `.html`, например `/horeca.html`. Ссылки сайта без расширения (`/horeca`, `/policy` и другие) работают на GitHub Pages после сборки `scripts/prepare-pages.sh`.

Форма заявки пока не отправляет данные: интеграция с Telegram-ботом будет добавлена позже.

Проверки CI можно запустить локально:

```sh
bash scripts/check-site.sh
```

Сборку для GitHub Pages можно посмотреть локально:

```sh
bash scripts/prepare-pages.sh
python3 -m http.server 8000 --directory dist
```

## GitHub Actions

В репозитории настроены два workflow:

| Workflow | Файл | Когда запускается |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | push и pull request в `main` |
| Deploy | `.github/workflows/deploy.yml` | push в `main` и вручную (`workflow_dispatch`) |

CI проверяет наличие обязательных файлов, валидность `sitemap.xml`, сборку для GitHub Pages и отсутствие случайно закоммиченных секретов.

Deploy собирает каталог `dist/` и публикует его на GitHub Pages. Дополнительные секреты для деплоя не нужны.

При сборке скрипт `prepare-pages.sh` автоматически добавляет префикс `/self-check-pro-site` к путям статики и ссылкам — иначе на адресе `https://mailigors.github.io/self-check-pro-site/` CSS и картинки отдают 404. Для своего домена в корне (`selfcheck.pro`) задайте `BASE_PATH=/` при сборке.

### Первый запуск

1. В репозитории открыть [Settings → Pages](https://github.com/mailigors/self-check-pro-site/settings/pages).
2. В **Build and deployment → Source** выбрать **GitHub Actions** (не «Deploy from a branch»).
3. Сохранить настройки и заново запустить workflow **Deploy** (Actions → Deploy → Run workflow) или запушить коммит в `main`.
4. После успешного деплоя сайт будет доступен по адресу **https://mailigors.github.io/self-check-pro-site/** или по своему домену.
5. Для домена `selfcheck.pro` указать его в **Settings → Pages → Custom domain** и настроить DNS у регистратора.

Если деплой падает с `Failed to create deployment (status: 404)`, GitHub Pages ещё не включён или выбран неверный источник. Нужен именно **GitHub Actions**, не ветка `gh-pages`. Для репозитория организации администратор организации также должен разрешить GitHub Pages в настройках org.

Предупреждение Node.js про `punycode` в логах Actions можно игнорировать — на деплой оно не влияет.

## Передача команде для развёртывания

- Публиковать результат `scripts/prepare-pages.sh`, а не сырой корень репозитория. GitHub Actions делает это автоматически.
- Маршруты без `.html` обеспечиваются структурой `/<страница>/index.html` в каталоге `dist/`.
- После настройки проверить открытие всех страниц.
- DNS и HTTPS для домена `selfcheck.pro` настраиваются в **Settings → Pages**.

## Что уточнить и доработать

- **Домен подтверждён:** `selfcheck.pro`; адрес кабинета в исходниках — `app.selfcheck.pro`.
- **Реквизиты:** в `policy.html` и `consent.html` найти `class="fill"` и заполнить ФИО, ИНН, ОГРНИП, адрес и дату редакции по применимости. Затем убрать подсветку `fill`. Сейчас страницы имеют `noindex`.
- **Цена:** на пяти коммерческих страницах стоит `0 000 ₽`.
- **Кейсы:** исходный README обозначал их как вымышленные; перед внешним запуском заменить подтверждёнными материалами или согласовать формулировки.
- **Контакты:** Telegram указан текстом без ссылки; подтвердить email и адрес кабинета.
- **Форма заявки:** подключить отправку напрямую в Telegram-бота.
- **Аналитика:** счётчик пока не подключён.
- **Шрифт:** Poppins загружается из Google Fonts.

## Дальнейшая работа

Общие стили меняются в `assets/styles.css`; тексты и скрипты находятся в HTML каждой страницы. Для общих правок проверять все пять коммерческих страниц и два юридических документа. Изменения передавать через коммиты и согласованный командой процесс review.

При подготовке удалены закомментированные блоки «Что получает каждый» и их неиспользуемые стили. Исходная версия сохранена в истории Git, коммит `8e2cff9`.
