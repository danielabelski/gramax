import getExtensions from "@ext/markdown/core/edit/logic/getExtensions";
import Comment from "@ext/markdown/elements/comment/edit/model/comment";
import Document from "@tiptap/extension-document";
import type { Extensions } from "@tiptap/react";

export const getInboxExtensions = (): Extensions => [
	...getExtensions(),
	Comment,
	Document.extend({ content: "paragraph block+" }),
];
