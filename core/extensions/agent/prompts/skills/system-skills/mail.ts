import { agentConfig } from "../../../core/agentConfig";
import type { AgentSkill } from "../skill";

export const mailSkill: AgentSkill = {
	name: "mail",
	itemPath: `${agentConfig.skillPrefix}/mail`,
	catalogName: agentConfig.systemPrefix,
	description: "Чтение и отправка писем через IMAP и SMTP.",
	content: `Сегодня: ${new Date().toISOString().slice(0, 10)}.

## Учётные данные

- Секрет \`Mail\`: логин — \`\${Mail.login}\`, пароль приложения — \`\${Mail.password}\`, домен — \`\${Mail.url}\`.
- Логин обычно полный email. Пароль приложения для почты, не пароль аккаунта.

## Протокол

- REST API нет. Не вызывай \`http_request\` к imap/smtp-хостам — это не HTTP.
- Для IMAP и SMTP используй \`mail_request\` с \`auth\`: \`{ "username": "\${Mail.login}", "password": "\${Mail.password}" }\`. LOGIN/AUTH делает инструмент сам.
- Чтение: \`imaps://imap.\${Mail.url}/INBOX\` (порт 993, path — mailbox). Команды без SELECT (например LIST): \`imaps://imap.\${Mail.url}\` без path.
- Отправка: \`smtps://smtp.\${Mail.url}\` (порт 465). \`command\` не передавай.
- Папки: единственное стабильное имя — \`INBOX\`. Остальные узнай через \`LIST "" "*"\` (ищи \`\\Sent\`, \`\\Trash\`, \`\\Junk\`, \`\\Drafts\`). Не подставляй Sent/Trash/Spam наугад.
- Ответ: \`status\` (IMAP OK/NO/BAD или SMTP 250), \`ok\`, \`body\` — сырой текст сервера. Не выдумывай письма.

## Список писем

\`command\` после SELECT mailbox из URL. Не тяни весь ящик: для «последние» ограничь ~20 UID.

- Непрочитанные: \`UID SEARCH UNSEEN\`
- За день: \`UID SEARCH SINCE 18-Aug-2026 BEFORE 19-Aug-2026\`
- От кого: \`UID SEARCH FROM "user@example.com"\`
- Тема: \`UID SEARCH CHARSET UTF-8 SUBJECT "тема"\`
- Заголовки: \`UID FETCH 1,2,3 (FLAGS ENVELOPE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])\`

Покажи дату, отправителя, тему, прочитано/нет, UID.

## Одно письмо

\`UID FETCH 42 (ENVELOPE BODY.PEEK[TEXT])\`. Вложения — только имена и размеры, не выгружай целиком.

## Отправка

\`command\` не передавай. \`body\` — RFC822, \`From\` — \`\${Mail.login}\`. Конверт (MAIL FROM / RCPT TO) берётся из заголовков \`From\`, \`To\`, \`Cc\`, \`Bcc\`.
В \`body\` обязателен MIME-минимум: \`MIME-Version: 1.0\`, \`Content-Type: text/plain; charset=utf-8\`, \`Content-Transfer-Encoding: 8bit\`, \`Date\`. \`Subject\` — RFC 2047 (\`=?UTF-8?B?...?=\`). Между заголовками и телом — пустая строка.

## Другие операции

- Удалить: \`UID STORE 42 +FLAGS (\\Deleted)\`, затем отдельным вызовом \`EXPUNGE\`.
- Переместить: \`UID MOVE 42 <папка>\`, имя папки возьми из LIST. Если MOVE не поддерживается: \`UID COPY\`, затем STORE + EXPUNGE.
- Ответить: сохрани \`In-Reply-To\` / \`References\`.

## Ограничения

- Ошибка логина: включён IMAP, пароль приложения именно для почты.
- Инструмент доступен только в desktop (Tauri). Только implicit TLS: IMAPS 993 и SMTPS 465. STARTTLS (порт 587) и OAuth2/XOAUTH2 не поддерживаются — Outlook / Microsoft 365, iCloud SMTP и Proton Mail этим инструментом не подключить.`,
};
