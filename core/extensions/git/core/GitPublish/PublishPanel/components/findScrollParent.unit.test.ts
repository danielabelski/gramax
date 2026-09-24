import { findScrollParent } from "./findScrollParent";

describe("publish tree findScrollParent", () => {
	it("returns the nearest scrollable ancestor", () => {
		const outer = document.createElement("div");
		const inner = document.createElement("div");
		const node = document.createElement("div");
		outer.style.overflowY = "scroll";
		inner.style.overflowY = "auto";
		outer.append(inner);
		inner.append(node);
		document.body.append(outer);

		expect(findScrollParent(node)).toBe(inner);

		outer.remove();
	});

	it("falls back to the document element", () => {
		const parent = document.createElement("div");
		const node = document.createElement("div");
		parent.append(node);
		document.body.append(parent);

		expect(findScrollParent(node)).toBe(document.documentElement);

		parent.remove();
	});
});
