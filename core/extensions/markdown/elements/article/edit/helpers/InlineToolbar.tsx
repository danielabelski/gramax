import { ARTICLE_CONTENT_WRAPPER_WIDTH_ATTRIBUTE } from "@components/Layouts/CatalogLayout/ArticleLayout/consts";
import { useArticleWidthStyle } from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import {
	ARTICLE_POPOVER_PADDING,
	getArticlePopoverBoundary,
	getArticlePopoverContainer,
} from "@ext/markdown/core/edit/logic/articlePopover";
import InlineEditPanel, {
	type InlineToolbarButtons,
} from "@ext/markdown/elements/article/edit/helpers/InlineEditPanel";
import { CustomBubbleMenu } from "@ext/markdown/elements/customBubbleMenu/edit/components/CustomBubbleMenu";
import type { Editor } from "@tiptap/react";
import { CellSelection, isInTable } from "prosemirror-tables";
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Instance, Props } from "tippy.js";

const INLINE_TOOLBAR_Z_INDEX = 49;

interface InlineToolbarProps {
	editor: Editor;
	shouldShow: (props: { editor: Editor }) => boolean;
	pluginKey?: string;
	buttons?: InlineToolbarButtons;
	boundaryRef?: RefObject<HTMLElement>;
}

export interface InlineToolbarOptions {
	isInTable: boolean;
	isCellSelection: boolean;
}

export const InlineToolbar = memo(({ editor, pluginKey, buttons, shouldShow, boundaryRef }: InlineToolbarProps) => {
	const isMobile = useMediaQuery(cssMedia.JSnarrow);
	const articleWidthStyle = useArticleWidthStyle();
	const [isPanelMounted, setIsPanelMounted] = useState(false);
	const isPanelMountedRef = useRef(false);

	const [options, setOptions] = useState<InlineToolbarOptions>(() => ({
		isInTable: isInTable(editor.state),
		isCellSelection: editor.state.selection instanceof CellSelection,
	}));
	const tippyInstanceRef = useRef<Instance<Props>>(null);

	useEffect(() => {
		if (!editor || isMobile) return;

		const onSelectionUpdate = ({ editor }: { editor: Editor }) => {
			const inTable = isInTable(editor.state);
			const isCellSelection = editor.state.selection instanceof CellSelection;

			setOptions({
				isInTable: inTable,
				isCellSelection,
			});
		};

		editor.on("selectionUpdate", onSelectionUpdate);
		return () => {
			editor.off("selectionUpdate", onSelectionUpdate);
		};
	}, [editor, isMobile]);

	const onShow = useCallback((instance: Instance<Props>) => {
		tippyInstanceRef.current = instance;
		requestAnimationFrame(() => {
			if (instance?.popperInstance) {
				instance.popperInstance.update();
			}
		});
	}, []);

	const closeHandler = useCallback(() => {
		if (tippyInstanceRef.current) {
			tippyInstanceRef.current.hide();
		}
	}, []);

	const onHide = useCallback(() => {
		tippyInstanceRef.current = null;
		editor.commands.focus();
	}, [editor]);

	const onHidden = useCallback(() => {
		isPanelMountedRef.current = false;
		setIsPanelMounted(false);
	}, []);

	const handleShouldShow = useCallback(
		(props: Parameters<typeof shouldShow>[0]) => {
			const show = shouldShow(props);
			if (!show || isPanelMountedRef.current) return show;

			flushSync(() => {
				isPanelMountedRef.current = true;
				setIsPanelMounted(true);
			});
			return true;
		},
		[shouldShow],
	);

	const appendTo = useCallback(() => {
		return getArticlePopoverContainer(editor, boundaryRef?.current);
	}, [boundaryRef, editor]);

	const getTippyOptions = useCallback((): Partial<Props> => {
		const boundary = getArticlePopoverBoundary(editor, boundaryRef?.current, "viewport");

		return {
			maxWidth: "unset",
			appendTo,
			interactive: true,
			arrow: false,
			sticky: true,
			offset: [0, 8],
			zIndex: INLINE_TOOLBAR_Z_INDEX,
			placement: "top-start",
			duration: [220, 200],
			animation: "article-popover",
			moveTransition: "transform 0.150s ease-in-out",
			onShow,
			onHide,
			onHidden,
			popperOptions: {
				modifiers: [
					{
						name: "preventOverflow",
						options: { boundary, padding: ARTICLE_POPOVER_PADDING },
					},
				],
			},
		};
	}, [appendTo, boundaryRef, editor, onHide, onHidden, onShow]);

	return (
		<CustomBubbleMenu
			editor={editor}
			pluginKey={pluginKey || "inline-toolbar"}
			shouldShow={handleShouldShow}
			tippyOptions={getTippyOptions}
		>
			<div
				className="article-popover article-popover-stagger rounded-lg sm:[&>div]:rounded-full"
				style={{
					...articleWidthStyle,
					maxWidth: `var(${ARTICLE_CONTENT_WRAPPER_WIDTH_ATTRIBUTE})`,
				}}
			>
				{isPanelMounted && (
					<InlineEditPanel
						buttons={buttons}
						className="shadow-glass-xl"
						closeHandler={closeHandler}
						editor={editor}
						{...options}
					/>
				)}
			</div>
		</CustomBubbleMenu>
	);
});
