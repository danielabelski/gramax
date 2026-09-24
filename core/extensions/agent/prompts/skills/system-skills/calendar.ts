import { agentConfig } from "../../../core/agentConfig";
import type { AgentSkill } from "../skill";

export const calendarSkill: AgentSkill = {
	name: "calendar",
	itemPath: `${agentConfig.skillPrefix}/calendar`,
	catalogName: agentConfig.systemPrefix,
	description:
		"События Yandex Calendar через CalDAV (http_request). Use when: календарь, встречи, события, расписание Yandex. Do NOT use для других календарей и задач без календаря.",
	content: `Сегодня: ${new Date().toISOString().slice(0, 10)}.

## Учётные данные

- Секрет \`Yandex calendar\` (тип login): email в URL — \`\${Yandex calendar.login}\`, пароль приложения — \`\${Yandex calendar.password}\`.

## Протокол

- Yandex Calendar работает через **CalDAV**, не через REST с query-параметрами.
- Базовый URL: \`https://caldav.yandex.ru/calendars/\${Yandex calendar.login}/events-default/\`.
- Для HTTP используй инструмент \`http_request\` с \`auth\`: \`{ "username": "\${Yandex calendar.login}", "password": "\${Yandex calendar.password}" }\`. Не собирай заголовок Authorization вручную.

## События за период (фильтр по дате)

- Метод: **REPORT** (не GET).
- Заголовки:
  - \`Content-Type: application/xml; charset=utf-8\`
  - \`Depth: 1\`
- Тело — XML \`calendar-query\` с \`time-range\` в **UTC**: \`yyyyMMdd'T'HHmmss'Z'\`.

Пример тела для одного дня (2026-07-09, UTC):

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
- Ответ — XML multistatus с фрагментами iCalendar внутри \`calendar-data\`. Извлеки \`SUMMARY\`, \`DTSTART\`, \`DTEND\`, \`UID\`, \`DESCRIPTION\`, \`LOCATION\` и покажи пользователю в читаемом виде.

## Другие операции

- **Список всех событий без фильтра** (тяжело для больших календарей): GET на \`.../events-default/\` — вернёт ссылки на .ics, не сами события.
- **Одно событие по URL**: GET на \`.../events-default/{uid}.ics\`.
- **Создать/изменить событие**: PUT на \`.../events-default/{uid}.ics\` с телом в формате iCalendar и \`Content-Type: text/calendar; charset=utf-8\`.
- **Удалить событие**: DELETE на \`.../events-default/{uid}.ics\`.

## Ограничения

- Повторяющиеся события (RRULE) CalDAV может вернуть не так, как ожидает пользователь — предупреди, если в ответе есть \`RRULE\`.
- Из web-версии запросы к \`caldav.yandex.ru\` могут блокироваться CORS; в desktop (Tauri) обычно работает.
- При ошибке 401 — попроси проверить пароль приложения. При 4xx/5xx — покажи status и фрагмент body.`,
};
