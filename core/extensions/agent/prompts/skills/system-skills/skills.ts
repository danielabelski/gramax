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

## Навигация 
- get_navigation для skills не работает — не используй его.
- Список существующих skills у тебя уже есть в контексте.

## Создание

- Для нового skill вызови create_catalog_item с itemPath=@skills/<имя> и title.

## Редактирование

- Для правок используй те же инструменты, что и для обычных статей: read_catalog_item, write_catalog_item, replace_catalog_item, delete_catalog_item.
- Сначала прочитай skill целиком через read_catalog_item с itemPath \`@skills/<имя>\`.
- Не ломай первый абзац: он остаётся кратким описанием skill.
- Системные skills (catalogName: "@system") read-only — их нельзя создавать или менять через инструменты каталога.`,
};
