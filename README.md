# SelfCheck Pro — сайт

Исходники сайта для совместной доработки внутри команды.
Репозиторий: https://github.com/mailigors/self-check-pro-site

Статический HTML/CSS и JavaScript без frontend-зависимостей. Целевое размещение — Selectel VDS: Nginx раздаёт сайт, небольшой Node.js-процесс отправляет заявки в Telegram. GitHub Pages остаётся превью без работающей формы.

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
| `server.mjs` | API заявок для VDS |
| `deploy/` | Конфигурации Nginx и systemd |

## Локальный просмотр

Из корня репозитория:

```sh
python3 -m http.server 8000
```

Открыть http://localhost:8000. На простом файловом сервере отраслевые и юридические страницы доступны с расширением `.html`, например `/horeca.html`. Ссылки сайта без расширения (`/horeca`, `/policy` и другие) работают на GitHub Pages после сборки `scripts/prepare-pages.sh`.

В обычном локальном превью отправка выключена. Сборка для VDS включает адрес `/api/lead`; инструкция: [docs/selectel-vds.md](docs/selectel-vds.md).

Проверки CI можно запустить локально:

```sh
bash scripts/check-site.sh
```

Сборку для GitHub Pages можно посмотреть локально:

```sh
bash scripts/prepare-pages.sh
python3 -m http.server 8000 --directory dist
```

Сборка и запуск API как на VDS:

```sh
npm run build
npm start
```

Перед запуском серверные переменные должны быть заданы в окружении. Не вводите токен прямо в командной строке: он попадёт в историю shell.

## GitHub Actions

В репозитории настроены два workflow:

| Workflow | Файл | Когда запускается |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | push и pull request в `main` |
| Deploy | `.github/workflows/deploy.yml` | push в `main` и вручную (`workflow_dispatch`) |
| Deploy VDS | `.github/workflows/deploy-vds.yml` | push в `main` и вручную (`workflow_dispatch`) |

CI проверяет наличие обязательных файлов, валидность `sitemap.xml`, сборку для GitHub Pages и отсутствие случайно закоммиченных секретов.

Deploy собирает каталог `dist/` и публикует превью на GitHub Pages. Дополнительные секреты не нужны; отправка форм в этом превью выключена.

Deploy VDS запускает проверки, передаёт release-архив на Callista и атомарно переключает рабочую версию после успешной сборки. Для workflow нужны секреты `VDS_HOST`, `VDS_SSH_KEY` и `VDS_KNOWN_HOSTS`. Пользователь `selfcheck-deploy` может менять только каталог приложения и перезапускать принадлежащий ему Node.js-процесс; root-доступ и sudo в GitHub Actions не передаются.

При сборке скрипт `prepare-pages.sh` автоматически добавляет префикс `/self-check-pro-site` к путям статики и ссылкам — иначе на адресе `https://mailigors.github.io/self-check-pro-site/` CSS и картинки отдают 404. Для своего домена в корне (`selfcheck.pro`) задайте `BASE_PATH=/` при сборке.

### Первый запуск

1. В репозитории открыть [Settings → Pages](https://github.com/mailigors/self-check-pro-site/settings/pages).
2. В **Build and deployment → Source** выбрать **GitHub Actions** (не «Deploy from a branch»).
3. Сохранить настройки и заново запустить workflow **Deploy** (Actions → Deploy → Run workflow) или запушить коммит в `main`.
4. После успешного деплоя сайт будет доступен по адресу **https://mailigors.github.io/self-check-pro-site/** или по своему домену.
5. Для домена `selfcheck.pro` указать его в **Settings → Pages → Custom domain** и настроить DNS у регистратора.

Если деплой падает с `Failed to create deployment (status: 404)`, GitHub Pages ещё не включён или выбран неверный источник. Нужен именно **GitHub Actions**, не ветка `gh-pages`. Для репозитория организации администратор организации также должен разрешить GitHub Pages в настройках org.

Предупреждение Node.js про `punycode` в логах Actions можно игнорировать — на деплой оно не влияет.

## Развёртывание на Selectel VDS

Пошаговая инструкция, требования к серверу и проверка находятся в [docs/selectel-vds.md](docs/selectel-vds.md). На сервер публикуется результат `npm run build`, а не сырой корень репозитория.

## Что уточнить и доработать

- **Домен подтверждён:** `selfcheck.pro`; адрес кабинета в исходниках — `app.selfcheck.pro`.
- **Базовый тариф:** `5 500 ₽/мес`, до 10 сотрудников, хранилище 5 ГБ.
- **Кейсы:** исходный README обозначал их как вымышленные; перед внешним запуском заменить подтверждёнными материалами или согласовать формулировки.
- **Контакты:** Telegram указан текстом без ссылки; подтвердить email и адрес кабинета.
- **Форма заявки:** код для VDS подготовлен; остаётся задать секреты на сервере и проверить реальные заявки после выкладки.
- **Аналитика:** счётчик пока не подключён.
- **Шрифт:** латинские начертания Poppins хранятся локально в `assets/fonts/poppins`; для кириллицы используется системный стек.

## Дальнейшая работа

Общие стили меняются в `assets/styles.css`; тексты находятся в HTML каждой страницы; общий скрипт форм — в `assets/lead-form.js`. Для общих правок проверять все пять коммерческих страниц и два юридических документа. Изменения передавать через коммиты и согласованный командой процесс review.

При подготовке удалены закомментированные блоки «Что получает каждый» и их неиспользуемые стили. Исходная версия сохранена в истории Git, коммит `8e2cff9`.
