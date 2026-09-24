/**
 * @jest-environment node
 */
import { createMergeDetector } from "./useHomepageMerge";

type MergeEvent = Parameters<ReturnType<typeof createMergeDetector>["isMergeActive"]>[0];

const eventWithRelativeCenter = (relX: number, relY: number) =>
	({
		over: { rect: { left: 0, top: 0, width: 100, height: 100 } },
		active: {
			rect: { current: { translated: { left: relX * 100 - 5, top: relY * 100 - 5, width: 10, height: 10 } } },
		},
	}) as MergeEvent;

describe("createMergeDetector", () => {
	test("keeps merge active while the dragged item stays inside the target band", () => {
		const detector = createMergeDetector();

		expect(detector.isMergeActive(eventWithRelativeCenter(0.5, 0.5), "card:a")).toBe(true);
		expect(detector.isMergeActive(eventWithRelativeCenter(0.55, 0.55), "card:a")).toBe(true);
	});

	test("turns merge off when the dragged item leaves the target edge tolerance", () => {
		const detector = createMergeDetector();

		expect(detector.isMergeActive(eventWithRelativeCenter(0.5, 0.5), "card:a")).toBe(true);
		expect(detector.isMergeActive(eventWithRelativeCenter(1.2, 0.5), "card:a")).toBe(false);
	});
});
