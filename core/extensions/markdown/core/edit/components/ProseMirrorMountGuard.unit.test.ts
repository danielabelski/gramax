import ProseMirrorMountGuard from "@ext/markdown/core/edit/components/ProseMirrorMountGuard";
import { act, render } from "@testing-library/react";
import { Component, createElement } from "react";

const createEditor = (style: CSSStyleDeclaration) =>
	({
		isDestroyed: false,
		view: { dom: { style } },
	}) as never;

describe("ProseMirrorMountGuard", () => {
	test("exposes overflowAnchor while descendants mount and restores it after commit", async () => {
		const style = {} as CSSStyleDeclaration;
		const valuesDuringMount: unknown[] = [];

		class MountProbe extends Component {
			componentDidMount() {
				valuesDuringMount.push(style.overflowAnchor);
			}

			render() {
				return null;
			}
		}

		render(createElement(ProseMirrorMountGuard, { editor: createEditor(style) }, createElement(MountProbe)));

		expect(valuesDuringMount).toEqual(["auto"]);
		await act(async () => {});
		expect("overflowAnchor" in style).toBe(false);
	});

	test("does not change an existing overflowAnchor value", async () => {
		const style = { overflowAnchor: "none" } as CSSStyleDeclaration;

		render(createElement(ProseMirrorMountGuard, { editor: createEditor(style) }, null));
		await act(async () => {});

		expect(style.overflowAnchor).toBe("none");
	});

	test("restores an existing null property descriptor", async () => {
		const style = {} as CSSStyleDeclaration;
		Object.defineProperty(style, "overflowAnchor", {
			configurable: true,
			enumerable: true,
			value: null,
			writable: false,
		});
		const originalDescriptor = Object.getOwnPropertyDescriptor(style, "overflowAnchor");

		render(createElement(ProseMirrorMountGuard, { editor: createEditor(style) }, null));
		await act(async () => {});

		expect(Object.getOwnPropertyDescriptor(style, "overflowAnchor")).toEqual(originalDescriptor);
	});

	test("restores the style when unmounted before the queued cleanup", () => {
		const style = {} as CSSStyleDeclaration;
		const view = render(createElement(ProseMirrorMountGuard, { editor: createEditor(style) }, null));

		expect(style.overflowAnchor).toBe("auto");
		view.unmount();
		expect("overflowAnchor" in style).toBe(false);
	});
});
