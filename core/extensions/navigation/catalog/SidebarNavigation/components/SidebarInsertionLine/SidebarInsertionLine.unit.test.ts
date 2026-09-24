import { SidebarInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/SidebarInsertionLine";
import { navigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";

describe("SidebarInsertionLine", () => {
	beforeEach(() => {
		jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		navigationTreeStore.setState({ draggingId: null });
	});

	const renderLine = () =>
		render(createElement(SidebarInsertionLine, { level: 1, maxDepth: 1, minDepth: 1, onAdd: jest.fn() }));
	const visualsOf = (container: HTMLElement) =>
		container.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]');

	/**
	 * The entrance takes two frames: the first lets the transparent state paint, the second starts the fade.
	 * Running only one leaves the visuals mounted and still transparent.
	 */
	const runEntranceFrames = () => {
		const frames = jest.mocked(window.requestAnimationFrame).mock.calls;
		act(() => frames[frames.length - 1][0](0));
		act(() => frames[frames.length - 1][0](0));
	};

	test("the transparent state gets a frame of its own, or the browser has nothing to fade from", () => {
		const { container } = renderLine();
		fireEvent.pointerEnter(container.querySelector('[data-sidebar="sidebar-insertion-line"]')!);
		const frames = jest.mocked(window.requestAnimationFrame).mock.calls;

		act(() => frames[0][0](0));
		expect(visualsOf(container)?.classList.contains("opacity-0")).toBe(true);

		act(() => frames[1][0](0));
		expect(visualsOf(container)?.classList.contains("opacity-100")).toBe(true);
	});

	test("a drag shows the visuals, and ending it takes that back", () => {
		// the drag force-shows every line in the tree; those lines were never pointer-entered, so nothing else
		// would ever hide them again and the next hover would skip the fade-in
		const { container } = renderLine();

		act(() => navigationTreeStore.setState({ draggingId: "dragged" }));
		expect(visualsOf(container)?.classList.contains("opacity-100")).toBe(true);

		act(() => navigationTreeStore.setState({ draggingId: null }));
		expect(visualsOf(container)).toBeNull();
	});

	test("a drag that ends under the pointer leaves the hover in charge", () => {
		const { container } = renderLine();
		fireEvent.pointerEnter(container.querySelector('[data-sidebar="sidebar-insertion-line"]')!);

		act(() => navigationTreeStore.setState({ draggingId: "dragged" }));
		act(() => navigationTreeStore.setState({ draggingId: null }));

		expect(visualsOf(container)?.classList.contains("opacity-100")).toBe(true);
	});

	test("keeps the original hitbox mounted and fades lazily mounted visuals in and out", () => {
		const { container } = render(
			createElement(SidebarInsertionLine, {
				level: 1,
				maxDepth: 1,
				minDepth: 1,
				onAdd: jest.fn(),
			}),
		);
		const hitbox = container.querySelector('[data-sidebar="sidebar-insertion-line"]');

		expect(hitbox).not.toBeNull();
		expect(hitbox?.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]')).toBeNull();

		fireEvent.pointerEnter(hitbox!);
		const visuals = hitbox?.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]');

		expect(visuals?.classList.contains("opacity-0")).toBe(true);
		expect(visuals?.classList.contains("delay-75")).toBe(true);

		runEntranceFrames();

		expect(visuals?.classList.contains("opacity-100")).toBe(true);

		fireEvent.pointerLeave(hitbox!);

		expect(visuals?.classList.contains("opacity-0")).toBe(true);
		expect(hitbox?.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]')).not.toBeNull();

		fireEvent.transitionEnd(visuals!);

		expect(hitbox?.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]')).toBeNull();
	});

	test("unmounts visuals when the pointer leaves before the entrance frame", () => {
		const { container } = render(
			createElement(SidebarInsertionLine, {
				level: 1,
				maxDepth: 1,
				minDepth: 1,
				onAdd: jest.fn(),
			}),
		);
		const hitbox = container.querySelector('[data-sidebar="sidebar-insertion-line"]')!;

		fireEvent.pointerEnter(hitbox);
		fireEvent.pointerLeave(hitbox);

		expect(hitbox.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]')).toBeNull();
	});

	test("restores opacity when the pointer returns during fade-out", () => {
		const { container } = render(
			createElement(SidebarInsertionLine, {
				level: 1,
				maxDepth: 1,
				minDepth: 1,
				onAdd: jest.fn(),
			}),
		);
		const hitbox = container.querySelector('[data-sidebar="sidebar-insertion-line"]')!;

		fireEvent.pointerEnter(hitbox);
		runEntranceFrames();
		fireEvent.pointerLeave(hitbox);
		fireEvent.pointerEnter(hitbox);

		const visuals = hitbox.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]');
		expect(visuals?.classList.contains("opacity-100")).toBe(true);

		fireEvent.transitionEnd(visuals!);
		expect(hitbox.querySelector('[data-sidebar="sidebar-insertion-line-visuals"]')).not.toBeNull();
	});
});
