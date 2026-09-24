import type { TemplateItemProps } from "@ext/templates/components/TemplatesPanel/types/constants";
import { getTemplateDescription } from "@ext/templates/components/TemplatesPanel/utils/templatesListUtils";
import type { JSONContent } from "@tiptap/core";

export const updateTemplateItem = (
	template: TemplateItemProps,
	content: JSONContent,
	title: string,
): TemplateItemProps => ({
	...template,
	title: title.trim(),
	description: getTemplateDescription(content),
	revision: (template.revision ?? 0) + 1,
});

export const mergeTemplateItems = (
	current: TemplateItemProps[],
	incoming: TemplateItemProps[] | null,
	selectedID?: string | null,
	requestRevisions: ReadonlyMap<string, number> = new Map(),
) => {
	if (!incoming) return current;

	const currentByID = new Map(current.map((template) => [template.id, template]));

	return incoming.map((template) => {
		const currentTemplate = currentByID.get(template.id);
		const requestRevision = requestRevisions.get(template.id) ?? 0;
		const hasNewerLocalRevision = (currentTemplate?.revision ?? 0) > requestRevision;

		return template.id === selectedID && hasNewerLocalRevision ? currentTemplate : template;
	});
};
