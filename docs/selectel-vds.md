# Развёртывание на Selectel VDS

Сайт и API заявок работают на одном VDS. Nginx раздаёт собранный каталог `dist/`, принимает HTTPS и проксирует только `/api/lead` в локальный Node.js-процесс. Node.js не доступен напрямую из интернета.

## Ресурсы

Для текущего сайта достаточно 1 vCPU, 1 ГБ RAM и 20–30 ГБ SSD. Если на VDS уже работают другие сервисы, перед изменением тарифа проверить их фактическое потребление командой `free -h`, `df -h` и через мониторинг Selectel.

Требуется Ubuntu 22.04/24.04 или совместимая система, Node.js 20+, Nginx, Git и Certbot.

## Первая установка

Команды выполняет администратор сервера. До начала нужно направить DNS-записи `selfcheck.pro` и `www.selfcheck.pro` на публичный IP VDS.

1. Создать системного пользователя `selfcheck` и каталог `/var/www/selfcheck-pro`.
2. Клонировать в каталог репозиторий `https://github.com/mailigors/self-check-pro-site.git`.
3. Выполнить `npm run build`. Сборка для VDS включает адрес формы `/api/lead`.
4. Создать `/etc/selfcheck-pro.env`:

   ```env
   HOST=127.0.0.1
   PORT=3000
   TELEGRAM_BOT_TOKEN=
   TELEGRAM_CHAT_ID=
   ```

   Внести токен владельца и ранее полученный ID группы. Файл должен принадлежать `root:root` и иметь права `600`. Токен не добавлять в Git, команды shell history или логи CI.

5. Скопировать `deploy/selfcheck-pro.service` в `/etc/systemd/system/`, выполнить `systemctl daemon-reload` и включить сервис командой `systemctl enable --now selfcheck-pro`.
6. Скопировать `deploy/nginx-selfcheck-pro.conf` в `/etc/nginx/conf.d/selfcheck-pro.conf`, проверить `nginx -t` и перечитать конфигурацию.
7. Выпустить сертификат Let's Encrypt для `selfcheck.pro` и `www.selfcheck.pro` через Certbot с интеграцией Nginx.

## Обновление

В `/var/www/selfcheck-pro`:

```sh
git pull --ff-only
npm test
npm run build
systemctl restart selfcheck-pro
```

Автоматическое обновление выполняет `.github/workflows/deploy-vds.yml` после push в `main`. Workflow использует отдельного непривилегированного пользователя `selfcheck-deploy`, запускает тесты и пользовательский скрипт `/home/selfcheck-deploy/bin/deploy-selfcheck`. У пользователя нет sudo и доступа к системным настройкам. Ключ, адрес VDS и проверенный host key хранятся только в GitHub Actions Secrets.

## Проверка

- `systemctl status selfcheck-pro` — процесс активен;
- `curl http://127.0.0.1:3000/healthz` — ответ `ok`;
- `curl https://selfcheck.pro/healthz` — ответ `ok`;
- главная и шесть внутренних страниц открываются по HTTPS;
- тестовая заявка с каждой из пяти форм приходит в группу `SelfCheck_leads`;
- повторные частые запросы ограничиваются Nginx.

После проверки удалить тестовые заявки из рабочей группы, если они не нужны.
