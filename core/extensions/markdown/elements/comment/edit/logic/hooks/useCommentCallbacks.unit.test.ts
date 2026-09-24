import type { CommentBlock } from "@core-ui/CommentBlock";
import { getEditorStore } from "@core-ui/stores/EditorStore";
import { addComment } from "@ext/markdown/elements/comment/edit/logic/stores/CommentsStore";
import { addReviewItem } from "@ext/review/logic/store/ReviewStore";
import { act, renderHook } from "@testing-library/react";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import useCommentCallbacks from "./useCommentCallbacks";

const mockFetch = jest.fn();

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: { getComment: jest.fn(), updateComment: jest.fn(), deleteComment: jest.fn() } },
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: { userInfo: { mail: "user@example.com", name: "User" } } },
}));
jest.mock("@core-ui/stores/EditorStore", () => ({ getEditorStore: jest.fn() }));
jest.mock("@ext/markdown/elements/comment/edit/logic/stores/CommentsStore", () => ({
	addComment: jest.fn(),
	deleteComment: jest.fn(),
}));
jest.mock("@ext/review/logic/store/ReviewStore", () => ({
	addReviewItem: jest.fn(),
	deleteReviewItem: jest.fn(),
}));

describe("useCommentCallbacks", () => {
	it("restores an undone comment locally without waiting for persistence", () => {
		const setIsOpen = jest.spyOn(useFloatingPanelStore.getState(), "setIsOpen");
		const comment = {
			comment: {
				content: [],
				dateTime: "2026-08-28T00:00:00.000Z",
				user: { mail: "author@example.com", name: "Author" },
			},
		} satisfies CommentBlock;
		const comments = new Map<string, CommentBlock>();
		const deleted = new Map([["comment-id", comment]]);
		(getEditorStore as jest.Mock).mockReturnValue({
			editor: { isDestroyed: false, storage: { comment: { comments, deleted } } },
		});
		mockFetch.mockReturnValue(new Promise(() => {}));

		const articlePropsRef = {
			current: { pathname: "/article", title: "Article", ref: { path: "article.md" } },
		} as never;
		const { result } = renderHook(() => useCommentCallbacks(articlePropsRef));

		act(() => {
			void result.current.onMarkAdded("comment-id");
		});

		expect(comments.get("comment-id")).toBe(comment);
		expect(deleted.has("comment-id")).toBe(false);
		expect(setIsOpen).not.toHaveBeenCalled();
		expect(addComment).toHaveBeenCalledWith("/article", comment.comment.user, "comment-id", "Article");
		expect(addReviewItem).toHaveBeenCalledWith(
			expect.objectContaining({ id: "comment-id", commentBlock: comment }),
		);
	});
});
