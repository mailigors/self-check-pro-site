"""Look up Telegram group IDs without saving or printing the bot token."""
import getpass
import json
import urllib.request
import urllib.error


def main():
    token = getpass.getpass('Ключ бота (ввод скрыт): ').strip()
    if not token:
        print('Ключ не введён.')
        return
    def api(method, payload=None):
        request = urllib.request.Request(
            'https://api.telegram.org/bot' + token + '/' + method,
            data=json.dumps(payload or {}).encode(),
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.load(response)
        if not result.get('ok'):
            raise ValueError('Telegram request failed')
        return result

    try:
        bot = api('getMe')['result']
        username = bot.get('username', '')
        print('Ключ принадлежит боту: @' + username)
        webhook = api('getWebhookInfo')['result']
        if webhook.get('url'):
            print('У бота уже подключён webhook. Получать ID нужно через его обработчик. Настройки не изменены.')
            return
        print('В группе SelfCheck_leads проверьте, что участник — именно @' + username)
        print('Отправьте в эту группу команду: /start@' + username)
        input('После отправки команды нажмите здесь Enter: ')
        result = api('getUpdates', {'timeout': 5, 'limit': 100})
    except urllib.error.HTTPError as error:
        if error.code == 409:
            print('Конфликт: возможно, подключён webhook или другой получатель обновлений. Сообщите разработчику; настройки не изменены.')
        elif error.code in (401, 404):
            print('Telegram не принял ключ. Проверьте, что он скопирован полностью.')
        else:
            print('Ошибка Telegram, HTTP', error.code)
        return
    except Exception:
        print('Не удалось получить ответ Telegram. Проверьте подключение и повторите.')
        return
    if not result.get('ok'):
        print('Telegram не подтвердил запрос.')
        return
    groups = {}
    for update in result.get('result', []):
        for kind in ('message', 'edited_message', 'my_chat_member', 'chat_member'):
            chat = update.get(kind, {}).get('chat', {})
            if chat.get('type') in ('group', 'supergroup'):
                groups[chat['id']] = chat.get('title', '(без названия)')
    if not groups:
        print('События из групп не найдены. Получено обновлений: ' + str(len(result.get('result', []))))
        print('Пришлите имя бота из строки выше и это число. Ключ присылать не нужно.')
        return
    for chat_id, title in groups.items():
        print('\nГруппа:', title)
        print('TELEGRAM_CHAT_ID', chat_id, sep='=')
    print('\nВыберите ID именно группы SelfCheck_leads. Ключ не сохранён.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nОтменено.')
