/**
 * Numbering references declared by `getWordDocumentStyles`.
 *
 * `docx` serializes a paragraph's numbering as the placeholder `{<reference>-<level>}`.
 * The plain export lets `Packer` resolve it; the template export resolves it itself in
 * `TemplateProcessor` against the template's own numbering styles. Both sides read this map,
 * so a new reference has to be added here and nowhere else.
 */
export const NUMBERING_TEMPLATE_STYLE_LINKS = {
	orderedList: "OrderedList",
	bulletList: "BulletList",
	taskList: "TaskList",
	taskListChecked: "TaskList",
} as const;

export type NumberingReference = keyof typeof NUMBERING_TEMPLATE_STYLE_LINKS;

export const TASK_LIST_REFERENCE = "taskList" satisfies NumberingReference;
export const TASK_LIST_CHECKED_REFERENCE = "taskListChecked" satisfies NumberingReference;

// Longest first: otherwise the "taskList" branch would shadow "taskListChecked".
const alternation = Object.keys(NUMBERING_TEMPLATE_STYLE_LINKS)
	.sort((a, b) => b.length - a.length)
	.join("|");

/** Matches a serialized numbering placeholder, capturing the reference name. */
export const NUMBERING_PLACEHOLDER_REGEX = new RegExp(`\\{(${alternation})-\\d+\\}`);
