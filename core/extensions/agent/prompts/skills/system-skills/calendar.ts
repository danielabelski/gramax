import { agentConfig } from "../../../core/agentConfig";
import type { AgentSkill } from "../skill";

export const calendarSkill: AgentSkill = {
	name: "calendar",
	itemPath: `${agentConfig.skillPrefix}/calendar`,
	catalogName: agentConfig.systemPrefix,
	description:
		"События календаря через CalDAV (http_request). Use when: календарь, встречи, события, расписание. Do NOT use для задач без календаря.",
	content: `Сегодня: ${new Date().toISOString().slice(0, 10)}.

## Учётные данные

- Секрет \`Calendar\` (тип login): логин — \`\${Calendar.login}\`, пароль приложения — \`\${Calendar.password}\`, CalDAV-сервер — \`\${Calendar.url}\`.
- \`Calendar.url\` — origin сервера (\`https://caldav.yandex.ru\`, \`https://caldav.icloud.com\`, \`https://cloud.example.com\`). Если схемы нет — добавь \`https://\`.
- Логин обычно полный email. Пароль приложения для календаря, не пароль аккаунта.

## Протокол

- Календарь работает через **CalDAV**, не через REST с query-параметрами.
- Для HTTP используй инструмент \`http_request\` с \`auth\`: \`{ "username": "\${Calendar.login}", "password": "\${Calendar.password}" }\`. Не собирай заголовок Authorization вручную.
- Коллекции получи GET на \`\${Calendar.url}/calendars/\${Calendar.login}/\` (со слешем). В ответе — ссылки на коллекции, не события. Относительные href резолви от origin.
- Если пользователь не указал календарь и коллекция одна — бери её. Если несколько — с именем вроде default / первую. Не подставляй \`events-default\` вслепую, если GET уже вернул список.

## События за период

- GET на коллекцию — список href событий, не сами события. Относительные href резолви от origin.
- Нужное событие — GET по href из этого списка, путь сам не собирай.
- Если ссылок много и нужен только день/интервал — вместо обхода всех файлов сделай **REPORT** на коллекцию с \`time-range\` в **UTC**: \`yyyyMMdd'T'HHmmss'Z'\`. Заголовки: \`Content-Type: application/xml; charset=utf-8\`, \`Depth: 1\`.

Пример тела REPORT для одного дня (2026-07-09, UTC):

\`\`\`xml
<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20260709T000000Z" end="20260710T000000Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>
\`\`\`

- Для локального дня пользователя пересчитай границы в UTC (например, Europe/Moscow: 00:00–24:00 MSK → соответствующий \`time-range\` в Z).
- Из iCalendar извлеки \`SUMMARY\`, \`DTSTART\`, \`DTEND\`, \`UID\`, \`DESCRIPTION\`, \`LOCATION\` и покажи в читаемом виде.

## Другие операции

- **Одно событие**: GET по href из списка коллекции.
- **Создать/изменить**: PUT на href события в коллекции с телом iCalendar и \`Content-Type: text/calendar; charset=utf-8\`. Новый href — \`{collection}{UID}\`, UID возьми из тела.
- **Удалить**: DELETE по href события.

## Ограничения

- Повторяющиеся события (RRULE) могут выглядеть иначе, чем в UI — предупреди, если в ответе есть \`RRULE\`.
- Из web-версии запросы к CalDAV могут блокироваться CORS; в desktop (Tauri) обычно работает.
- Basic auth. OAuth (Google Calendar и подобные) этим скиллом не подключить.
- При ошибке 401 — попроси проверить пароль приложения и URL сервера. При 4xx/5xx — покажи status и фрагмент body.`,
};
