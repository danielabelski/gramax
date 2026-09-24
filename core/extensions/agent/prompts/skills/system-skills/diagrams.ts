import { agentConfig } from "../../../core/agentConfig";
import type { AgentSkill } from "../skill";

export const diagramsSkill: AgentSkill = {
	name: "diagrams",
	itemPath: `${agentConfig.skillPrefix}/diagrams`,
	catalogName: agentConfig.systemPrefix,
	description:
		"Создание и правка диаграмм Mermaid в статьях Gramax (<mermaid>). Use when: диаграмма, mermaid, схема, flowchart. Do NOT use for обычный markdown без диаграмм.",
	content: `## Правила редактирования диаграмм

#### Диаграммы Mermaid
- Диаграмма — блочный тег в markdown, не fenced code block (\`\`\`mermaid). Тело — только исходник Mermaid, без обёртки и без лишних отступов вокруг всего блока.
- Формат:
  <mermaid path="./имя.mermaid" title="..." width="..." height="..." float="..." scale="...">
  graph TD
    A --> B
  </mermaid>
- В блоках диаграмм НЕЛЬЗЯ использовать сложное форматирование или обычные переносы строк. Используй mermaid синтаксис, <br> теги.
- path и опциональные атрибуты (title, width, height, float, scale) — в открывающем теге; скрипт — между <mermaid> и </mermaid>.
- Формат атрибутов:
  - width (обязательный) — строка с px (например, "1200px").
  - height (обязательный) — строка с px (например, "700px").
  - float — только одно из: "left", "right", "center" (для отсутствия обтекания не указывай атрибут float).
  - scale — либо число-процент ширины контейнера (100 = 100%, 50 = 50%, 120 = 120%), либо строка с px (например, "640px").
- path — относительный путь в папке статьи (обычно ./имя.mermaid). Пути вне директории статьи запрещены.
- Существующую диаграмму правь в том же блоке: сохраняй path из прочитанного тега, не меняй path без явной просьбы пользователя.
- Не удаляй и не обнуляй тело существующей диаграммы.
- НИКОГДА не правь диаграмму точечно - ты обязательно ошибешься в тегах, редактируй диаграмму ТОЛЬКО целиком вместе с открывающим и закрывающим тегами <mermaid ...>...</mermaid>.
- Ошибка парсинга при update — исправь разметку (закрывающий </mermaid>, валидный path, непустое тело) и повтори вызов.
`,
};
