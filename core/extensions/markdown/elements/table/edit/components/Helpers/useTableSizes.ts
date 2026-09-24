import { getTableSizes, type TableSizes } from "@ext/markdown/elements/table/edit/logic/utils";
import { type MutableRefObject, useEffect, useState } from "react";

export type TableDataString = TableSizes;

const useTableSizes = (tableRef: MutableRefObject<HTMLTableElement>, onChangeChildCount?: () => void) => {
	const [tableSizes, setTableSizes] = useState<TableDataString>(null);

	useEffect(() => {
		const table = tableRef.current;
		if (!table) return;

		const updateSizes = () => setTableSizes(getTableSizes(table));

		const tableObserver = new ResizeObserver(updateSizes);

		const observer = new MutationObserver((mutationsList) => {
			const filterNodes = (nodes: NodeList) => {
				return Array.from(nodes).filter((node: HTMLElement) => {
					return (
						!node?.classList?.contains("column-resize-handle") &&
						node?.dataset?.tablePlusPreview !== "row" &&
						node?.dataset?.tablePlusPreview !== "column"
					);
				});
			};

			for (const mutation of mutationsList) {
				const resizerAddHandlesCount = filterNodes(mutation.addedNodes).length;
				const resizerRemoveHandlesCount = filterNodes(mutation.removedNodes).length;
				const isChildListType = mutation.type === "childList";
				const isAddNodesNonZero = resizerAddHandlesCount !== 0;
				const isRemovedNodesNonZero = resizerRemoveHandlesCount !== 0;
				const isAddNodes = resizerAddHandlesCount === mutation.addedNodes.length;
				const isRemovedNodes = resizerRemoveHandlesCount === mutation.removedNodes.length;

				if (
					isChildListType &&
					((isAddNodesNonZero && isAddNodes) || (isRemovedNodesNonZero && isRemovedNodes))
				) {
					updateSizes();
					return onChangeChildCount?.();
				}
			}
		});

		// The rows live in the tbody, and ProseMirror can put that tbody in place after this effect
		// has already run — nested in another node view it usually does. Watching whichever child
		// happens to be last then leaves the controls measured against a table with no rows: their
		// grid stays 0px wide and every button becomes unclickable.
		let body: HTMLElement = null;
		const observeBody = () => {
			const currentBody = table.tBodies[0];
			if (!currentBody || currentBody === body) return false;

			body = currentBody;
			tableObserver.disconnect();
			observer.disconnect();
			tableObserver.observe(body);
			observer.observe(body, { childList: true, subtree: true });
			return true;
		};

		const bodyObserver = new MutationObserver(() => {
			if (observeBody()) updateSizes();
		});
		bodyObserver.observe(table, { childList: true });

		observeBody();
		updateSizes();

		return () => {
			bodyObserver.disconnect();
			tableObserver.disconnect();
			observer.disconnect();
		};
	}, [tableRef.current, onChangeChildCount]);

	return { tableSizes };
};

export default useTableSizes;
