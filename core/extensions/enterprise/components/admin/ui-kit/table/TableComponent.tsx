import { TableLoadingRow } from "@ext/enterprise/components/admin/ui-kit/table/TableLoadingRow";
import type { ColumnDef, Table as ReactTable, Row } from "@ui-kit/DataTable";
import { OffsetScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Table, TableBody } from "@ui-kit/Table";
import { useCallback, useEffect, useRef } from "react";
import { MemoizedTableRow } from "./MemoizedTableRow";
import { TableBodyComponent } from "./TableBodyComponent";
import { TableHeaderComponent } from "./TableHeaderComponent";

export const TABLE_SELECT_COLUMN_CODE = "select";
export const TABLE_EDIT_COLUMN_CODE = "edit";
export const TABLE_DRAGGABLE_COLUMN_CODE = "draggable";

export interface TableComponentProps<T> {
	table: ReactTable<T>;
	columns: ColumnDef<T>[];
	onRowClick?: (row: Row<T>) => void;
	sortable?: boolean;
	onBottomReached?: () => void;
	isLoading?: boolean;
	isLoadingMore?: boolean;
	rowVersions?: Map<string, number>;
	rowSelection?: Record<string, boolean>;
}

export const TableComponent = <T,>(props: TableComponentProps<T>) => {
	const {
		table,
		columns,
		onRowClick,
		sortable,
		onBottomReached,
		isLoading,
		isLoadingMore,
		rowVersions,
		rowSelection,
	} = props;
	const containerRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadingMoreRef = useRef(isLoadingMore);
	loadingMoreRef.current = isLoadingMore;

	useEffect(() => {
		if (!onBottomReached || !sentinelRef.current || !containerRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !loadingMoreRef.current) onBottomReached();
			},
			{ root: containerRef.current, threshold: 0 },
		);
		observer.observe(sentinelRef.current);
		return () => observer.disconnect();
	}, [onBottomReached]);

	const renderRow = useCallback(
		(row: Row<T>) => (
			<MemoizedTableRow
				key={row.id}
				onRowClick={onRowClick}
				row={row}
				rowSelection={rowSelection}
				rowVersions={rowVersions}
			/>
		),
		[onRowClick, rowVersions, rowSelection],
	);

	const rows = table.getRowModel()?.rows ?? [];

	return (
		<div className="rounded-lg overflow-hidden border min-h-0">
			<OffsetScrollShadowContainer
				className="h-full [&>div>div]:overflow-visible"
				ref={containerRef}
				topOffset={41}
			>
				<Table>
					<TableHeaderComponent
						className="sticky top-0 [box-shadow:0_1px_0_0_hsl(var(--border))] [&_tr]:border-0"
						sortable={sortable}
						table={table}
					/>
					{isLoading || (rows.length === 0 && isLoadingMore) ? (
						<>
							<TableBody>
								<TableLoadingRow columns={columns} />
							</TableBody>
						</>
					) : (
						<TableBodyComponent
							columns={columns}
							renderRow={renderRow}
							rows={rows}
							sentinelRef={onBottomReached ? sentinelRef : undefined}
						/>
					)}
				</Table>
			</OffsetScrollShadowContainer>
		</div>
	);
};
