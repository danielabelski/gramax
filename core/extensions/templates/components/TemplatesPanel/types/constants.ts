import type { ProviderItemProps } from "@ext/articleProvider/models/types";

export const TEMPLATES_PANEL_ID = "templates-library";

export interface TemplateItemProps extends ProviderItemProps {
	description?: string | null;
	revision?: number;
}

export interface TemplateSearchItem {
	title?: string | null;
	description?: string | null;
}
