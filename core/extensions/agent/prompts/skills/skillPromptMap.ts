export const SKILL_PROMPT_MAP = {
	skillsPreamble:
		"Доступные agent skills. Description — when to use. Читай skill через read_catalog_item с catalogName и itemPath из списка.",
	systemSkillsPreamble: 'Системные skills (read-only). catalogName: "@system".',
	catalogSkillsPreamble: "Skills каталога, можно read, create, write, replace, delete.",
	forcedSkillPreamble:
		"Пользователь попросил использовать именно этот agent skill. Его полный контент уже дан ниже. Считай этот контент обязательной инструкцией и НЕ вызывай read_catalog_item для этого skill повторно (вызов возможен только для других skills при необходимости).",
} as const;
