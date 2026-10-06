import { ImageObjectTypes, type SquareObject } from "@ext/markdown/elements/image/edit/model/imageEditorTypes";
import ObjectRenderer from "@ext/markdown/elements/image/render/components/ObjectRenderer";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, createRef } from "react";

const square = (text: string, x: number, y: number, w: number, h: number): SquareObject => ({
	type: ImageObjectTypes.Square,
	direction: "top-left",
	text,
	x,
	y,
	w,
	h,
});

const renderObjects = (
	objects: SquareObject[],
	{ editable = false, selectedIndex }: { editable?: boolean; selectedIndex?: number } = {},
) => {
	const parent = document.createElement("div");
	document.body.appendChild(parent);

	const parentRef = createRef<HTMLDivElement>() as { current: HTMLDivElement };
	const imageRef = createRef<HTMLImageElement>() as { current: HTMLImageElement };
	parentRef.current = parent;
	imageRef.current = document.createElement("img");

	const { container } = render(
		createElement(ObjectRenderer, { editable, imageRef, objects, parentRef, selectedIndex }),
		{
			container: parent,
		},
	);

	return (index: number) => container.querySelector<HTMLElement>(`[id="object/${index}"]`);
};

const zIndexOf = (element: HTMLElement | null) => {
	// Guard the setup: a missing element would read as z-index 0 and make the stacking
	// assertions below fail for the wrong reason.
	expect(element).not.toBeNull();
	return Number(element.style.zIndex || 0);
};

describe("ObjectRenderer stacking order for overlapping annotations", () => {
	it("puts a nested square above the one containing it when the container comes last", () => {
		// "section" fully contains "folder". The containing square is last in the array, so with
		// no explicit stacking order it paints over the nested one and steals its hover tooltip.
		const objectAt = renderObjects([square("folder", 20, 20, 10, 10), square("section", 10, 10, 50, 50)]);

		expect(zIndexOf(objectAt(0))).toBeGreaterThan(zIndexOf(objectAt(1)));
	});

	it("puts a nested square above the one containing it when the container comes first", () => {
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)]);

		expect(zIndexOf(objectAt(1))).toBeGreaterThan(zIndexOf(objectAt(0)));
	});

	it("keeps a nested square above its selected container in the editor", () => {
		// Selecting the big square must not lift its body over the nested one: the body would catch
		// every click on the nested square, which could then be neither selected nor moved.
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)], {
			editable: true,
			selectedIndex: 0,
		});

		expect(zIndexOf(objectAt(1))).toBeGreaterThan(zIndexOf(objectAt(0)));
	});

	it("keeps a selected nested square above its container in the editor", () => {
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)], {
			editable: true,
			selectedIndex: 1,
		});

		expect(zIndexOf(objectAt(1))).toBeGreaterThan(zIndexOf(objectAt(0)));
	});

	it("renders the selected square's resize handles in a layer above every object", () => {
		// The handles must not live inside the square: its z-index makes it a stacking context, so a
		// nested square would cover them. A sibling layer on top keeps them reachable for any object.
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)], {
			editable: true,
			selectedIndex: 0,
		});

		const selected = objectAt(0);
		expect(selected.querySelector(".handle")).toBeNull();

		const layer = selected.parentElement.querySelector<HTMLElement>(".handles-layer");
		expect(layer).not.toBeNull();
		expect(layer.querySelectorAll(".handle")).toHaveLength(4);
		expect(layer.style.left).toBe(selected.style.left);
		expect(layer.style.width).toBe(selected.style.width);
		expect(zIndexOf(layer)).toBeGreaterThan(Math.max(zIndexOf(objectAt(0)), zIndexOf(objectAt(1))));
	});

	it("moves the handle layer together with the square while it is dragged", async () => {
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)], {
			editable: true,
			selectedIndex: 0,
		});

		const selected = objectAt(0);
		selected.style.left = "33px";
		selected.style.width = "44px";
		await new Promise((resolve) => setTimeout(resolve, 0));

		const layer = selected.parentElement.querySelector<HTMLElement>(".handles-layer");
		expect(layer.style.left).toBe("33px");
		expect(layer.style.width).toBe("44px");
	});

	it("shows the nested square's own text when the pointer is over it", async () => {
		const objectAt = renderObjects([square("section", 10, 10, 50, 50), square("folder", 20, 20, 10, 10)]);

		fireEvent.pointerMove(objectAt(1), { pointerType: "mouse" });

		expect((await screen.findAllByText("folder")).length).toBeGreaterThan(0);
		expect(screen.queryByText("section")).toBeNull();
	});
});
