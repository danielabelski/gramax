/**
 * @jest-environment node
 */

import type { HomeSections } from "../utils/homeLayoutTypes";
import { createHomepageCollisionDetection } from "./homepageCollisionDetection";
import { cardId, dropZoneId, GROUP_ID_PREFIX } from "./ids";

type HomepageCollisionArgs = Parameters<ReturnType<typeof createHomepageCollisionDetection>>[0];

const rect = (left: number, top: number, width: number, height: number) => ({
	bottom: top + height,
	height,
	left,
	right: left + width,
	top,
	width,
});

const droppable = (id: string) => ({ id }) as HomepageCollisionArgs["droppableContainers"][number];

describe("createHomepageCollisionDetection", () => {
	test("chooses an item only from the container under the pointer", () => {
		const items: HomeSections = [
			{ id: "first", items: [{ type: "catalog", name: "a" }] },
			{ id: "second", items: [{ type: "catalog", name: "b" }] },
		];
		const collisionDetection = createHomepageCollisionDetection(() => items);
		const result = collisionDetection({
			active: { id: cardId("a") },
			collisionRect: rect(0, 140, 10, 10),
			droppableContainers: [
				droppable(dropZoneId("first")),
				droppable(dropZoneId("second")),
				droppable(cardId("a")),
				droppable(cardId("b")),
			],
			droppableRects: new Map([
				[dropZoneId("first"), rect(0, 0, 100, 100)],
				[dropZoneId("second"), rect(0, 120, 100, 100)],
				[cardId("a"), rect(0, 0, 100, 100)],
				[cardId("b"), rect(0, 120, 100, 100)],
			]),
			pointerCoordinates: { x: 10, y: 145 },
		} as HomepageCollisionArgs);

		expect(result[0]?.id).toBe(cardId("b"));
	});

	test("uses group droppables for group dragging", () => {
		const collisionDetection = createHomepageCollisionDetection(() => []);
		const result = collisionDetection({
			active: { id: `${GROUP_ID_PREFIX}first` },
			collisionRect: rect(0, 0, 10, 10),
			droppableContainers: [droppable(`${GROUP_ID_PREFIX}first`), droppable(dropZoneId("first"))],
			droppableRects: new Map([
				[`${GROUP_ID_PREFIX}first`, rect(0, 0, 100, 100)],
				[dropZoneId("first"), rect(0, 0, 100, 100)],
			]),
			pointerCoordinates: { x: 10, y: 10 },
		} as HomepageCollisionArgs);

		expect(String(result[0]?.id)).toBe(`${GROUP_ID_PREFIX}first`);
	});
});
