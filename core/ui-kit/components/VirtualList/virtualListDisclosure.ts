export type ListRow<T> = { key: string; item: T; index: number; size: number };
export type Disclosure<T> = {
	type: "disclosure";
	key: string;
	rows: ListRow<T>[];
	offsets: number[];
	indexes: Map<string, number>;
	index: number;
	from: number;
	to: number;
	height: { current: number };
};
export type ListEntry<T> = { type: "row"; key: string; row: ListRow<T> } | Disclosure<T>;

export const rowEntries = <T>(rows: ListRow<T>[]): ListEntry<T>[] =>
	rows.map((row) => ({ type: "row", key: `row:${row.key}`, row }));

export const createDisclosure = <T>(
	previous: ListRow<T>[],
	next: ListRow<T>[],
	running: Disclosure<T> | null,
): Disclosure<T> | null => {
	let start = 0;
	while (start < previous.length && start < next.length && previous[start].key === next[start].key) start++;
	let end = 0;
	while (
		end < previous.length - start &&
		end < next.length - start &&
		previous[previous.length - 1 - end].key === next[next.length - 1 - end].key
	)
		end++;
	const added = next.length - start - end;
	const removed = previous.length - start - end;
	if (added > 0 === removed > 0) return null;
	const rows = added ? next.slice(start, start + added) : previous.slice(start, start + removed);
	const offsets = [0];
	for (const row of rows) offsets.push(offsets[offsets.length - 1] + row.size);
	const fullHeight = offsets[offsets.length - 1];
	const reversing =
		running &&
		running.index === start &&
		running.rows.length === rows.length &&
		running.rows.every((row, index) => row.key === rows[index].key);
	const from = reversing ? running.height.current : added ? 0 : fullHeight;
	return {
		type: "disclosure",
		key: `disclosure:${rows[0].key}`,
		rows,
		offsets,
		indexes: new Map(rows.map((row, index) => [row.key, index])),
		index: start,
		from,
		to: added ? fullHeight : 0,
		height: { current: from },
	};
};

export const disclosureEntries = <T>(rows: ListRow<T>[], disclosure: Disclosure<T>): ListEntry<T>[] => [
	...rowEntries(rows.slice(0, disclosure.index)),
	disclosure,
	...rowEntries(rows.slice(disclosure.index + (disclosure.to > 0 ? disclosure.rows.length : 0))),
];

const rowAtOffset = (offsets: number[], offset: number) => {
	let low = 0;
	let high = offsets.length - 1;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (offsets[middle] <= offset) low = middle;
		else high = middle - 1;
	}
	return low;
};

export const disclosureWindow = <T>(
	disclosure: Disclosure<T>,
	height: number,
	viewportStart: number,
	viewportEnd: number,
	pinnedKeys: string[],
) => {
	const start = Math.max(0, viewportStart);
	const end = Math.min(height, viewportEnd);
	const indexes = new Set<number>();
	if (end > start) {
		const first = Math.max(0, rowAtOffset(disclosure.offsets, start) - 8);
		const last = Math.min(disclosure.rows.length - 1, rowAtOffset(disclosure.offsets, end) + 8);
		for (let index = first; index <= last; index++) indexes.add(index);
	}
	for (const key of pinnedKeys) {
		const index = disclosure.indexes.get(key);
		if (index !== undefined) indexes.add(index);
	}
	return [...indexes].sort((a, b) => a - b);
};

// Matches the UI kit's collapsible-down/up curve: cubic-bezier(0.22, 1, 0.36, 1).
export const disclosureProgress = (progress: number) => {
	if (progress >= 1) return 1;
	let low = 0;
	let high = 1;
	for (let iteration = 0; iteration < 16; iteration++) {
		const t = (low + high) / 2;
		const x = 3 * (1 - t) ** 2 * t * 0.22 + 3 * (1 - t) * t ** 2 * 0.36 + t ** 3;
		if (x < progress) low = t;
		else high = t;
	}
	return 1 - (1 - (low + high) / 2) ** 3;
};
