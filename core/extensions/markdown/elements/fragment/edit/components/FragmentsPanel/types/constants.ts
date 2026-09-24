import type { ProviderItemProps } from "@ext/articleProvider/models/types";

export const FRAGMENTS_PANEL_ID = "fragments-library";
export const FRAGMENTS_PANEL_ZONE = "fragment";

export type FragmentListItem = Omit<ProviderItemProps, "title"> & {
	title?: string | null;
	description?: string | null;
};
