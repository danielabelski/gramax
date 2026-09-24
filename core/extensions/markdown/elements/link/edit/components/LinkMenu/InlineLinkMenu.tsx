import { useEscapeKeydown } from "@core-ui/hooks/useEscapeKeyDown";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import {
	ARTICLE_POPOVER_PADDING,
	getArticlePopoverBoundary,
	getArticlePopoverContainer,
} from "@ext/markdown/core/edit/logic/articlePopover";
import { CustomBubbleMenu } from "@ext/markdown/elements/customBubbleMenu/edit/components/CustomBubbleMenu";
import { LinkMenu, type LinkMenuMode } from "@ext/markdown/elements/link/edit/components/LinkMenu/LinkMenu";
import { useLinkMenuState } from "@ext/markdown/elements/link/edit/hooks/useLinkMenuState";
import { getMarkEndPos } from "@ext/markdown/elementsUtils/getMarkEndPos";
import { getMarkStartPos } from "@ext/markdown/elementsUtils/getMarkStartPos";
import { type Editor, posToDOMRect } from "@tiptap/react";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Instance, Placement, Props } from "tippy.js";

interface InlineLinkMenuProps {
	editor: Editor;
	fallbackPlacements?: Placement[];
	placement?: Placement;
	boundary?: "viewport" | "scrollParent" | "window" | HTMLElement;
	boundaryRef?: RefObject<HTMLElement>;
}

export const InlineLinkMenu = (props: InlineLinkMenuProps) => {
	const {
		editor,
		fallbackPlacements = ["top-start", "bottom-start"],
		placement = "bottom-start",
		boundary = "viewport",
		boundaryRef,
	} = props;
	const {
		mark,
		isOpen,
		shouldShow: shouldShowLinkMenu,
		onUpdate,
		reset,
		getMark,
		handleDelete,
	} = useLinkMenuState(editor);
	const isMobile = useMediaQuery(cssMedia.JSnarrow);
	const [mode, setMode] = useState<LinkMenuMode>(mark?.attrs?.href ? "view" : "edit");
	const instanceRef = useRef<Instance<Props>>(null);

	const shouldShow = useCallback(() => {
		if (isMobile) return false;

		let show = false;
		flushSync(() => {
			show = shouldShowLinkMenu();
		});
		return show;
	}, [shouldShowLinkMenu, isMobile]);

	const getReferenceClientRect = useCallback(() => {
		const { from, empty } = editor.state.selection;
		if (!empty) return { top: 0, left: 0, width: 0, height: 0 } as DOMRect;

		const docSize = editor.state.doc.content.size;
		if (from + 1 > docSize) return { top: 0, left: 0, width: 0, height: 0 } as DOMRect;

		const { after: nextMarkIsLink, before: beforeMarkIsLink, current: currentMarkIsLink } = getMark(from);

		if (!currentMarkIsLink && !nextMarkIsLink && !beforeMarkIsLink) {
			return { top: 0, left: 0, width: 0, height: 0 } as DOMRect;
		}

		const sameMarkOnBothSides = nextMarkIsLink && beforeMarkIsLink && nextMarkIsLink.eq(beforeMarkIsLink);
		const findPos = sameMarkOnBothSides ? from : nextMarkIsLink ? from + 1 : from - 1;
		const startPos = getMarkStartPos(editor.state.doc, "link", findPos);
		const endPos = getMarkEndPos(editor.state.doc, "link", findPos);

		return posToDOMRect(editor.view, startPos, endPos);
	}, [editor, getMark]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		if (!instanceRef.current) return;
		requestAnimationFrame(() => {
			if (instanceRef.current?.popperInstance) {
				instanceRef.current.popperInstance.update();
			}
		});
	}, [mode]);

	useEscapeKeydown(reset);

	const appendTo = useCallback(() => {
		return getArticlePopoverContainer(editor, boundaryRef?.current);
	}, [boundaryRef, editor]);
	const popoverBoundary = getArticlePopoverBoundary(editor, boundaryRef?.current, boundary);

	return (
		<CustomBubbleMenu
			className="article-popover article-popover-stagger"
			editor={editor}
			pluginKey="new-link-menu"
			shouldShow={shouldShow}
			tippyOptions={{
				maxWidth: "unset",
				onCreate: (instance) => {
					instanceRef.current = instance;
				},
				appendTo,
				interactive: true,
				arrow: false,
				sticky: true,
				offset: [-10, 8],
				zIndex: 50,
				popperOptions: {
					modifiers: [
						{
							name: "flip",
							options: {
								fallbackPlacements,
								boundary: popoverBoundary,
							},
						},
						{
							name: "preventOverflow",
							options: {
								altAxis: true,
								boundary: popoverBoundary,
								padding: ARTICLE_POPOVER_PADDING,
							},
						},
					],
				},
				duration: [220, 200],
				animation: "article-popover",
				placement,
				getReferenceClientRect,
				onHide: reset,
			}}
		>
			{!isMobile && mark && isOpen && (
				<LinkMenu mark={mark} mode={mode} onDelete={handleDelete} onUpdate={onUpdate} setMode={setMode} />
			)}
		</CustomBubbleMenu>
	);
};
