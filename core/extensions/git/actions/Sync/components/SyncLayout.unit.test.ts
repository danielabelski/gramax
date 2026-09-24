import { render } from "@testing-library/react";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import SyncLayout from "./SyncLayout";

describe("SyncLayout", () => {
	it("uses SVG animation for sync progress without CSS transform animation", () => {
		const layout = createElement(SyncLayout, {
			pullCounter: 0,
			pushCounter: 0,
			sourceInvalid: false,
			syncProccess: true,
		});

		const { container } = render(createElement(TooltipProvider, null, createElement(GlassToolbar, null, layout)));
		const icon = container.querySelector("svg");

		expect(icon?.classList.contains("lucide-refresh-cw")).toBe(true);
		expect(icon?.querySelectorAll("path")).toHaveLength(4);
		expect(icon?.querySelector("animateTransform")).not.toBeNull();
		expect(icon?.classList.contains("animate-sync-progress")).toBe(false);
		expect(icon?.classList.contains("animate-spin")).toBe(false);
		expect(icon?.classList.contains("transform-gpu")).toBe(false);
	});
});
