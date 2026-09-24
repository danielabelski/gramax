import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { selectHomeSections, useHomepageLayoutStore } from "../store/homepageLayoutStore";
import { catalogItem } from "../utils/homeLayoutBuilders";
import type { HomeSections } from "../utils/homeLayoutTypes";
import { useHomepageDnd } from "./useHomepageDnd";

// dnd-kit's sensors and collision detection are its own machinery; this suite drives the drag callbacks directly.
const OVER_SIZE = 100;

/**
 * `isMergeActive` reads the geometry of the drag, so every event carries the dragged center as a fraction of the
 * target rect. The center of the target merges; a corner is outside both merge bands and reorders instead.
 */
const MERGE = { relX: 0.5, relY: 0.5 };
const REORDER = { relX: 0.9, relY: 0.9 };

const dragEvent = (activeId: string, overId: string | null, at = REORDER) =>
	({
		active: {
			id: activeId,
			rect: {
				current: {
					translated: {
						left: at.relX * OVER_SIZE - 5,
						top: at.relY * OVER_SIZE - 5,
						width: 10,
						height: 10,
					},
				},
			},
		},
		over: overId === null ? null : { id: overId, rect: { left: 0, top: 0, width: OVER_SIZE, height: OVER_SIZE } },
	}) as unknown as DragMoveEvent & DragOverEvent & DragEndEvent;

const twoSections = (): HomeSections => [
	{ id: "left", items: [catalogItem("a"), catalogItem("b")] },
	{ id: "right", items: [catalogItem("c")] },
];

const withFolder = (): HomeSections => [
	{ id: "left", items: [{ type: "folder", id: "f", title: "F", items: ["x", "y"] }, catalogItem("a")] },
	{ id: "right", items: [catalogItem("c")] },
];

const emptyRight = (): HomeSections => [
	{ id: "left", items: [catalogItem("a"), catalogItem("b")] },
	{ id: "right", items: [] },
];

const seed = (sections: HomeSections) =>
	useHomepageLayoutStore.setState({
		activeView: "global",
		views: { global: { sections }, personal: { sections: [] } },
		history: [],
		future: [],
	});

const storeSections = () => selectHomeSections(useHomepageLayoutStore.getState());

/** Layout as `[["a", "b"], ["c"]]`; folders show up as `[folder-id]`. */
const layout = (sections: HomeSections) =>
	sections.map((section) => section.items.map((item) => (item.type === "catalog" ? item.name : `[${item.id}]`)));

const render = (sections: HomeSections) => renderHook(() => useHomepageDnd(sections, {})).result;

type Dnd = ReturnType<typeof render>;

const dragStart = (dnd: Dnd, activeId: string) =>
	act(() => dnd.current.onDragStart({ active: { id: activeId } } as unknown as DragStartEvent));

const dragMove = (dnd: Dnd, activeId: string, overId: string, at = REORDER) =>
	act(() => dnd.current.onDragMove(dragEvent(activeId, overId, at)));

const dragOver = (dnd: Dnd, activeId: string, overId: string, at = REORDER) =>
	act(() => dnd.current.onDragOver(dragEvent(activeId, overId, at) as DragOverEvent));

const dragEnd = (dnd: Dnd, activeId: string, overId: string | null, at = REORDER) =>
	act(() => dnd.current.onDragEnd(dragEvent(activeId, overId, at)));

/** Lets the scheduled `requestAnimationFrame` of a merge exit run. */
const nextFrame = () => act(() => void jest.advanceTimersByTime(20));

beforeEach(() => {
	jest.useFakeTimers();
	seed(twoSections());
});

afterEach(() => {
	jest.useRealTimers();
});

describe("reorder", () => {
	test("reorders items inside one section", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b");

		expect(layout(dnd.current.dndSections)).toEqual([["b", "a"], ["c"]]);
	});

	test("moves an item across sections", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:c");

		expect(layout(dnd.current.dndSections)).toEqual([["b"], ["a", "c"]]);
	});

	test("saves the reordered layout on drop", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b");
		dragEnd(dnd, "card:a", "card:b");

		expect(layout(storeSections())).toEqual([["b", "a"], ["c"]]);
	});

	test("reorders sections when a section header is dragged", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "group:left");
		dragOver(dnd, "group:left", "group:right");
		expect(dnd.current.dndSections.map((section) => section.id)).toEqual(["right", "left"]);

		dragEnd(dnd, "group:left", "group:right");

		expect(storeSections().map((section) => section.id)).toEqual(["right", "left"]);
	});
});

describe("merge", () => {
	test("raises the drop indicator while hovering the center of another card", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b", MERGE);

		expect(dnd.current.dropIndicator).toEqual({ targetType: "card", targetId: "b" });
		expect(layout(dnd.current.dndSections)).toEqual([["a", "b"], ["c"]]);
	});

	test("merges the two cards into a folder on drop", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b", MERGE);
		dragEnd(dnd, "card:a", "card:b", MERGE);

		// the folder takes the place of the merge target, so the target comes first
		const [left] = storeSections();
		expect(left.items).toHaveLength(1);
		expect(left.items[0]).toMatchObject({ type: "folder", title: "b & a", items: ["b", "a"] });
	});

	test("drops the indicator and reorders on the next frame once the drag leaves the merge band", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b", MERGE);
		dragMove(dnd, "card:a", "card:b", REORDER);

		expect(dnd.current.dropIndicator).toBeNull();
		expect(layout(dnd.current.dndSections)).toEqual([["a", "b"], ["c"]]);

		nextFrame();

		expect(layout(dnd.current.dndSections)).toEqual([["b", "a"], ["c"]]);
	});

	test("saves the merge exit reorder even when the drop lands before its frame runs", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b", MERGE);
		dragMove(dnd, "card:a", "card:b", REORDER);
		dragEnd(dnd, "card:a", "card:b", REORDER);

		expect(layout(storeSections())).toEqual([["b", "a"], ["c"]]);
	});
});

describe("drop outside any target", () => {
	test("keeps a reorder that happened during the drag", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b");
		dragEnd(dnd, "card:a", null);

		expect(layout(storeSections())).toEqual([["b", "a"], ["c"]]);
	});

	test("does not touch the store when nothing was reordered", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragEnd(dnd, "card:a", null);

		expect(useHomepageLayoutStore.getState().history).toHaveLength(0);
		expect(layout(storeSections())).toEqual([["a", "b"], ["c"]]);
	});
});

describe("edge cases", () => {
	/**
	 * Only `onDragMove` owns the merge latch. If `onDragOver` armed it too, leaving the band would look like a merge
	 * exit and defer the reorder by a frame, so this asserts the reorder lands immediately instead.
	 */
	test("does not arm a merge exit when only onDragOver saw the merge", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragOver(dnd, "card:a", "card:b", MERGE);
		dragMove(dnd, "card:a", "card:b", REORDER);

		expect(layout(dnd.current.dndSections)).toEqual([["b", "a"], ["c"]]);
	});

	test("keeps the pending merge exit reorder of the previous target after merging into a new one", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b", MERGE);
		dragMove(dnd, "card:a", "card:b", REORDER); // schedules the exit reorder of card:b
		dragMove(dnd, "card:a", "card:c", MERGE); // ...while the merge target is already card:c

		expect(dnd.current.dropIndicator).toEqual({ targetType: "card", targetId: "c" });

		nextFrame();

		expect(layout(dnd.current.dndSections)).toEqual([["b", "a"], ["c"]]);
		expect(dnd.current.dropIndicator).toEqual({ targetType: "card", targetId: "c" });
	});

	// A dragged folder never merges — only cards do. Each case drives a single handler: `onDragMove` and `onDragOver`
	test("reorders a dragged folder instead of merging it, even over the center of a card", () => {
		seed(withFolder());
		const dnd = render(withFolder());

		dragStart(dnd, "folder:f");
		dragMove(dnd, "folder:f", "card:a", MERGE);

		expect(dnd.current.dropIndicator).toBeNull();
		expect(layout(dnd.current.dndSections)).toEqual([["a", "[f]"], ["c"]]);

		dragEnd(dnd, "folder:f", "card:a", MERGE);

		expect(layout(storeSections())).toEqual([["a", "[f]"], ["c"]]);
	});

	/**
	 * dnd-kit fires both handlers on the frame the target changes, both carrying the new target, so the same move is
	 * applied twice and the items end up back where they started. That is load-bearing, not a bug: on that frame the
	 * visible motion comes from dnd-kit's own sortable transform, and our layout catches up on the next frame.
	 * Reordering from `onDragMove` alone was tried on 2026-07-30 and killed the reorder animation.
	 */
	test("cancels itself out when both handlers fire for the same target", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b");
		dragOver(dnd, "card:a", "card:b");

		expect(layout(dnd.current.dndSections)).toEqual([["a", "b"], ["c"]]);
	});

	test("moves an item into an empty section through its drop zone", () => {
		seed(emptyRight());
		const dnd = render(emptyRight());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "zone:right");

		expect(dnd.current.dropIndicator).toBeNull();
		expect(layout(dnd.current.dndSections)).toEqual([["b"], ["a"]]);

		dragEnd(dnd, "card:a", "zone:right");

		expect(layout(storeSections())).toEqual([["b"], ["a"]]);
	});

	test("ignores a new sourceSections while a drag is running", () => {
		const { result, rerender } = renderHook(({ sections }) => useHomepageDnd(sections, {}), {
			initialProps: { sections: twoSections() },
		});

		act(() => result.current.onDragStart({ active: { id: "card:a" } } as unknown as DragStartEvent));
		act(() => result.current.onDragMove(dragEvent("card:a", "card:b")));
		expect(layout(result.current.dndSections)).toEqual([["b", "a"], ["c"]]);

		act(() => rerender({ sections: twoSections() }));

		expect(layout(result.current.dndSections)).toEqual([["b", "a"], ["c"]]);

		act(() => result.current.onDragEnd(dragEvent("card:a", "card:b")));

		expect(layout(storeSections())).toEqual([["b", "a"], ["c"]]);
	});
});

describe("cancel", () => {
	test("restores the layout from the store", () => {
		const dnd = render(twoSections());

		dragStart(dnd, "card:a");
		dragMove(dnd, "card:a", "card:b");
		expect(layout(dnd.current.dndSections)).toEqual([["b", "a"], ["c"]]);

		act(() => dnd.current.onDragCancel());

		expect(layout(dnd.current.dndSections)).toEqual([["a", "b"], ["c"]]);
		expect(useHomepageLayoutStore.getState().history).toHaveLength(0);
	});
});
