import type { ItemProps } from "@core/FileStructue/Item/Item";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import type { JSONContent } from "@tiptap/core";

export type Author = string;

export type InboxProps = ItemProps & {
	date?: string;
	author?: Author;
	fileName?: string;
	welcome?: boolean;
};

export type InboxArticle = ProviderItemProps & {
	editTree: JSONContent;
	props: {
		date: string;
		author: Author;
	};
};
