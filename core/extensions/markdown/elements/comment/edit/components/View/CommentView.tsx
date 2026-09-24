import Tooltip from "@components/Atoms/Tooltip";
import type { CommentBlock } from "@core-ui/CommentBlock";
import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { useModalBlocker } from "@core-ui/stores/ModalBlockerStore";
import t from "@ext/localization/locale/translate";
import { ARTICLE_POPOVER_PADDING, getArticlePopoverBoundary } from "@ext/markdown/core/edit/logic/articlePopover";
import { Comment } from "@ext/markdown/elements/comment/edit/components/Popover/Comment";
import { confirmCommentClose } from "@ext/markdown/elements/comment/edit/logic/confirmCommentClose";
import GlobalEditorIsEditable from "@ext/markdown/elements/comment/edit/logic/GlobalIsEditable";
import { markItemAsRead } from "@ext/review/logic/store/ReviewNotificationsStore";
import { type Editor, type JSONContent, posToDOMRect, type Range } from "@tiptap/core";
import { isInDropdown } from "@ui-kit/Dropdown";
import { type CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Instance, Props } from "tippy.js";
import { isCommentBlockDirty } from "../../logic/isCommentBlockDirty";

export type CommentViewProps = {
	commentId: string;
	editor: Editor;
	loadComment: (id: string) => Promise<CommentBlock>;
	saveComment: (id: string, comment: CommentBlock) => void;
	deleteComment: (id: string, positions: Range[]) => void;
};

const CommentView = memo((props: CommentViewProps) => {
	const { editor, commentId, loadComment, saveComment, deleteComment } = props;
	const isReadOnly = !editor.isEditable;
	const [data, setData] = useState<CommentBlock>(null);
	const [dataCommentId, setDataCommentId] = useState<string>(null);
	const [isOpen, setIsOpen] = useState(false);
	const appendCommentToBody =
		editor.extensionManager.extensions.find((ext) => ext.name === "comment")?.options.appendCommentToBody ?? false;

	const elementRef = useRef<HTMLDivElement>(null);
	const openedCommentIdRef = useRef<string>(null);
	const closingCommentIdRef = useRef<string>(null);
	const instanceRef = useRef<Instance<Props>>(null);
	const flagNoDeleteRef = useRef<boolean>(null);

	const pageData = PageDataContext.value;

	const close = useCallback(() => {
		closingCommentIdRef.current = openedCommentIdRef.current;
		setIsOpen(false);
	}, []);

	useEffect(() => {
		if (!commentId) return;
		openedCommentIdRef.current = commentId;

		let cancelled = false;
		void (async () => {
			const comment = (await loadComment(commentId)) || {};
			if (cancelled) return;
			setData(comment);
			setDataCommentId(commentId);
			setIsOpen(true);
			markItemAsRead(commentId);
		})();

		return () => {
			cancelled = true;
		};
	}, [commentId, loadComment]);

	useEffect(() => {
		if (!editor || editor.isDestroyed) return;

		const hideComment = () => {
			if (isReadOnly || !isCommentBlockDirty(instanceRef.current)) return close();
			void confirmCommentClose().then((result) => {
				if (result) close();
			});
		};

		const onSelectionUpdate = ({ editor }: { editor: Editor }) => {
			const openedCommentId = openedCommentIdRef.current;
			if (!openedCommentId) return;

			const { selection, doc } = editor.state;
			const node = doc.nodeAt(selection.anchor);
			if (!node) return hideComment();

			const commentMark = node.marks.find((mark) => mark.type.name === "comment");
			const commentIdAttribute = node.attrs.comment?.id;

			const id = commentMark?.attrs.id || commentIdAttribute;
			if (!id) return hideComment();

			if (openedCommentId === id) return;
			hideComment();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			const instance = instanceRef.current;
			if (event.key === "Escape" && instance?.state.isVisible) hideComment();
		};

		document.addEventListener("keydown", onKeyDown, { capture: true });
		editor.on("selectionUpdate", onSelectionUpdate);

		return () => {
			document.removeEventListener("keydown", onKeyDown, { capture: true });
			editor.off("selectionUpdate", onSelectionUpdate);
		};
	}, [editor, isReadOnly, close]);

	useModalBlocker("comment-popover", isOpen);

	const onHidden = useCallback(() => {
		if (isOpen || openedCommentIdRef.current !== closingCommentIdRef.current) return;

		if (!data?.comment && !flagNoDeleteRef.current) editor.commands.unsetCurrentComment();
		else editor.commands.closeComment();

		flagNoDeleteRef.current = null;

		setData(null);
		setDataCommentId(null);
		openedCommentIdRef.current = null;
	}, [editor, data, isOpen]);

	const createComment = useCallback(
		(content: JSONContent[]) => {
			const userInfo = pageData.user.info;
			const newData = {
				comment: {
					dateTime: new Date().toISOString(),
					user: {
						mail: userInfo.mail,
						name: userInfo.name,
					},
					content,
				},
				answers: [],
			};
			saveComment(openedCommentIdRef.current, newData);
			close();
		},
		[saveComment, close],
	);

	const onAddAnswer = useCallback(
		(commentBlock: CommentBlock, hide: boolean = true) => {
			saveComment(openedCommentIdRef.current, commentBlock);
			flagNoDeleteRef.current = true;

			const instance = instanceRef.current;
			if (hide) return close();

			requestAnimationFrame(() => {
				if (instance?.popperInstance) {
					instance.popperInstance.update();
				}
			});
			setData(commentBlock);
		},
		[saveComment, close],
	);

	const onDelete = useCallback(async () => {
		if (!(await confirm(t("confirm-comment-delete")))) return;
		const positions = editor.storage.comment.positions;
		const commentId = openedCommentIdRef.current;
		if (!commentId) return;

		deleteComment(commentId, positions.get(commentId) || []);
		close();
	}, [deleteComment, editor, close]);

	const onDeleteAnswer = useCallback(
		(commentBlock: CommentBlock) => {
			saveComment(openedCommentIdRef.current, commentBlock);

			requestAnimationFrame(() => {
				if (instanceRef.current?.popperInstance) {
					instanceRef.current.popperInstance.update();
				}
			});
			setData(commentBlock);
		},
		[saveComment],
	);

	const onCreate = useCallback(
		(commentBlock: CommentBlock) => {
			flagNoDeleteRef.current = true;
			createComment(commentBlock.comment.content);
		},
		[createComment],
	);

	const styles = useMemo(() => {
		return {
			visibility: "hidden",
		} as CSSProperties;
	}, []);
	const popoverBoundary = appendCommentToBody ? "viewport" : getArticlePopoverBoundary(editor, undefined, "viewport");
	const popoverPadding = appendCommentToBody ? { left: 8, right: 8, top: 8, bottom: 16 } : ARTICLE_POPOVER_PADDING;

	const getReferenceClientRect = useCallback(() => {
		const position = editor.storage?.comment?.openedComment?.position;
		if (!position) return { top: 0, left: 0, width: 0, height: 0 } as DOMRect;

		const node = editor.view.nodeDOM(position.from) as HTMLElement;
		if (!node) return posToDOMRect(editor.view, position.from, position.to);

		return node.firstElementChild?.getBoundingClientRect() ?? posToDOMRect(editor.view, position.from, position.to);
	}, [editor]);

	const onOutsideClick = useCallback(
		(_, event) => {
			const target = event.target as HTMLElement;
			if (editor.view.dom.contains(target) || isInDropdown(event)) return;
			if (isReadOnly || !isCommentBlockDirty(instanceRef.current)) return close();
			void confirmCommentClose().then((result) => {
				if (result) close();
			});
		},
		[editor, isReadOnly, close],
	);

	return (
		<div ref={elementRef} style={styles}>
			<Tooltip
				animation="article-popover"
				appendTo={() => (appendCommentToBody ? document.body : editor.view.dom.parentElement)}
				arrow={false}
				content={
					<GlobalEditorIsEditable.Provider value={editor?.isEditable}>
						{data && (
							<Comment
								commentId={dataCommentId}
								data={data}
								key={dataCommentId}
								onAddAnswer={onAddAnswer}
								onClose={close}
								onCreate={onCreate}
								onDelete={onDelete}
								onDeleteAnswer={onDeleteAnswer}
								user={pageData.user.info}
							/>
						)}
					</GlobalEditorIsEditable.Provider>
				}
				contentClassName="article-popover"
				customStyle
				distance={4}
				duration={[220, 200]}
				getReferenceClientRect={getReferenceClientRect}
				hideInMobile={false}
				interactive
				maxWidth="none"
				onClickOutside={onOutsideClick}
				onHidden={onHidden}
				onMount={(instance) => {
					instanceRef.current = instance;
				}}
				placement="bottom-start"
				popperOptions={{
					modifiers: [
						{
							name: "preventOverflow",
							options: {
								padding: popoverPadding,
								boundary: popoverBoundary,
							},
						},
						{
							name: "flip",
							options: {
								fallbackPlacements: ["top-start", "bottom-start"],
								boundary: popoverBoundary,
							},
						},
					],
				}}
				reference={elementRef}
				sticky={true}
				visible={isOpen}
				zIndex={10}
			/>
		</div>
	);
});

export default CommentView;
