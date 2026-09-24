import StickyTableWrapper from "@components/StickyWrapper/StickyTableWrapper";
import { NodeViewContextableWrapper } from "@ext/markdown/core/element/NodeViewContextableWrapper";
import AggregationFooter from "@ext/markdown/elements/table/edit/components/Helpers/AggregationFooter";
import ColGroup from "@ext/markdown/elements/table/edit/components/Helpers/ColGroup";
import TableHelper from "@ext/markdown/elements/table/edit/components/Helpers/TableHelper";
import useFilterAndSort from "@ext/markdown/elements/table/edit/logic/sortAndFilter/useFilterAndSort";
import TableNodeSheet from "@ext/markdown/elements/table/edit/logic/TableNodeSheet";
import tablePropsStore from "@ext/markdown/elements/table/edit/logic/tablePropsStore";
import TableWrapper from "@ext/markdown/elements/table/render/components/TableWrapper";
import { type NodeViewProps, useReactNodeView } from "@tiptap/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

const TableComponent = (props: NodeViewProps) => {
	const { node, getPos, editor } = props;
	const { nodeViewContentRef } = useReactNodeView();

	const tableRef = useRef<HTMLTableElement>(null);
	const hoverElementRef = useRef<HTMLTableElement>(null);

	const [parentElement, setParentElement] = useState<HTMLElement>(null);
	const isDisabledWrapper = Boolean(parentElement);

	// The element itself, never a lookup done once: the table is rendered by this component, and
	// holding it through a query that runs a single time leaves the ref on a detached table as
	// soon as React rebuilds the subtree.
	const setTableRef = useCallback(
		(element: HTMLTableElement | null) => {
			nodeViewContentRef(element);
			tableRef.current = element;
		},
		[nodeViewContentRef],
	);

	useLayoutEffect(() => {
		const pos = getPos();
		if (typeof pos !== "number") {
			setParentElement(null);
			return;
		}

		const Pos = editor.state.doc.resolve(pos);
		const parentPos = Pos.depth > 0 ? Pos.start(Pos.depth) : null;
		const parentDom = parentPos ? editor.view.domAtPos(parentPos) : null;

		if (parentDom?.node && parentDom.node.nodeType !== Node.TEXT_NODE) {
			setParentElement(parentDom.node as HTMLElement);
			return;
		}
		setParentElement(null);
	}, [editor, getPos]);

	const pos = getPos();

	const filterAndSortProps = useFilterAndSort(node, editor, pos);
	const tableSheet = useMemo(() => TableNodeSheet.createFromProseMirrorNode(node, pos), [node, pos]);

	useLayoutEffect(() => {
		tablePropsStore.updateTableProps(pos, filterAndSortProps);
	}, [filterAndSortProps, pos]);

	const { active, aggregation, tableData, sorted } = filterAndSortProps;

	const table = useMemo(
		() => (
			<TableWrapper activeFilter={active.filter} tableData={tableData}>
				<table
					className="tableComponent"
					data-header={node.attrs.header}
					data-node-view-content=""
					data-qa={"table"}
					data-testid={"table"}
					ref={setTableRef}
					{...(filterAndSortProps.sorted ? { "data-sorted": "" } : {})}
				>
					<ColGroup content={node.firstChild} parentElement={parentElement} />
					<AggregationFooter aggregation={aggregation} />
				</table>
			</TableWrapper>
		),
		[
			node.attrs.header,
			node.firstChild,
			setTableRef,
			parentElement,
			active,
			aggregation,
			tableData,
			filterAndSortProps.sorted,
		],
	);

	if (!editor.isEditable) {
		return (
			<NodeViewContextableWrapper props={props} ref={hoverElementRef}>
				<StickyTableWrapper disableWrapper={isDisabledWrapper} tableRef={tableRef}>
					{table}
				</StickyTableWrapper>
			</NodeViewContextableWrapper>
		);
	}

	return (
		<NodeViewContextableWrapper props={props} ref={hoverElementRef}>
			<TableHelper
				disableWrapper={isDisabledWrapper}
				editor={editor}
				hoverElementRef={hoverElementRef}
				node={node}
				pos={pos}
				sorted={sorted}
				tableRef={tableRef}
				tableSheet={tableSheet}
			>
				{table}
			</TableHelper>
		</NodeViewContextableWrapper>
	);
};

export default TableComponent;
