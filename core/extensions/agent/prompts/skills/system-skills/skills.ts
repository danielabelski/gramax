import { agentConfig } from "../../../core/agentConfig";
import type { AgentSkill } from "../skill";

export const skillsSkill: AgentSkill = {
	name: "skills",
	itemPath: `${agentConfig.skillPrefix}/skills`,
	catalogName: agentConfig.systemPrefix,
	description:
		"Создание и правка agent skills каталога (@skills/<имя>). Use when: создать/изменить skill, написать skill. Do NOT use для системных skills (@system) и обычных статей.",
	content: `
## Структура skill

- ПЕРВЫЙ АБЗАЦ ТЕКСТА СКИЛЛА считается его описанием и попадает в список доступных skills; остальное — инструкции.

## Где живут skills

- Пользовательские skills лежат внутри обычного каталога, отдельного каталога под них нет.
- \`@skills\` — префикс itemPath, а не имя каталога. В catalogName подставляй настоящий каталог: тот, что открыт у пользователя, или тот, который он назвал.
- \`@system\` — алиас только для чтения системных skills, создавать и менять в нём нельзя.

## Навигация
- get_navigation для skills не работает — обходить нечего, у \`@skills\` нет своего дерева.
- Список существующих skills у тебя уже есть в контексте.

## Создание

- Для нового skill вызови create_catalog_item с catalogName=<настоящий каталог>, itemPath=@skills/<имя> и title.
- Пример: catalogName=\`new-catalog\`, itemPath=\`@skills/apple-calendar\`, title=\`Apple Calendar\`.

## Редактирование

- Для правок используй те же инструменты, что и для обычных статей: read_catalog_item, write_catalog_item, replace_catalog_item, delete_catalog_item.
- Сначала прочитай skill целиком через read_catalog_item с itemPath \`@skills/<имя>\`.
- Не ломай первый абзац: он остаётся кратким описанием skill.
- Системные skills (catalogName: "@system") read-only — их нельзя создавать или менять через инструменты каталога.`,
};
