import { setQuote } from "@ext/agent/components/store/ChatStore";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Position {
	top: number;
	left: number;
}

const QUOTABLE_SELECTOR = "[data-agent-quotable]";

const getQuotableRoot = (node: Node | null): HTMLElement | null => {
	const element = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement;
	return element?.closest<HTMLElement>(QUOTABLE_SELECTOR) ?? null;
};

export interface SelectionQuoteTooltipProps {
	containerRef: RefObject<HTMLElement>;
}

export const SelectionQuoteTooltip = ({ containerRef }: SelectionQuoteTooltipProps) => {
	const [position, setPosition] = useState<Position | null>(null);
	const [selectedText, setSelectedText] = useState("");

	const hide = useCallback(() => {
		setPosition(null);
		setSelectedText("");
	}, []);

	useEffect(() => {
		const onSelectionChange = () => {
			const container = containerRef.current;
			const selection = window.getSelection();
			if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
				hide();
				return;
			}

			const range = selection.getRangeAt(0);
			const quotableRoot = getQuotableRoot(range.commonAncestorContainer);
			if (!quotableRoot || !container.contains(quotableRoot)) {
				hide();
				return;
			}

			const text = selection.toString().trim();
			if (!text) {
				hide();
				return;
			}

			const rects = Array.from(range.getClientRects());
			const topRect = rects.reduce(
				(topmost, rect) => (rect.top < topmost.top ? rect : topmost),
				rects[0] ?? range.getBoundingClientRect(),
			);
			setSelectedText(text);
			setPosition({ top: topRect.top, left: topRect.left + topRect.width / 2 });
		};

		document.addEventListener("selectionchange", onSelectionChange);
		return () => document.removeEventListener("selectionchange", onSelectionChange);
	}, [containerRef, hide]);

	useEffect(() => {
		if (!position) return;
		window.addEventListener("scroll", hide, true);
		window.addEventListener("resize", hide);
		return () => {
			window.removeEventListener("scroll", hide, true);
			window.removeEventListener("resize", hide);
		};
	}, [position, hide]);

	const onAskAgent = useCallback(() => {
		setQuote({ text: selectedText });
		window.getSelection()?.removeAllRanges();
		hide();
	}, [selectedText, hide]);

	if (!position) return null;

	return createPortal(
		<div
			className="fixed z-50 -translate-x-1/2 -translate-y-full"
			style={{ top: position.top - 6, left: position.left }}
		>
			<Button
				className="whitespace-nowrap pl-3 font-normal"
				iconClassName="-scale-x-100"
				onClick={onAskAgent}
				onMouseDown={(e) => e.preventDefault()}
				size="md"
				startIcon="message-circle-2"
				variant="outline"
			>
				{t("agent.ask-agent")}
			</Button>
		</div>,
		document.body,
	);
};
