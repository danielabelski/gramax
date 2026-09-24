import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

const ESTIMATED_ROW_HEIGHT_PX = 52;

/** Virtualizes AgentSecretsTable's rows so a large secret list doesn't mount every `Select`/`Input`/
 *  `Controller` at once. Rows have no fixed height class (unlike e.g. `LazyInfinityTable`'s `h-10`
 *  rows), so `measureElement` corrects the estimate against the real rendered height per row instead
 *  of requiring one hardcoded value to be exactly right. */
export const useAgentSecretsTableVirtualizer = (rowCount: number) => {
	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
		overscan: 8,
	});

	return { scrollRef, virtualizer };
};
