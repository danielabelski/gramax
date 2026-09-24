import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import type { RenderableTreeNode } from "@ext/markdown/core/render/logic/Markdoc";

export interface FragmentItemProps extends ProviderItemProps {
	description?: string;
	revision?: number;
}

export interface FragmentEditorProps {
	title: string;
	id: string;
}

export interface FragmentRenderData extends FragmentEditorProps {
	content: RenderableTreeNode[];
	path?: string;
}
