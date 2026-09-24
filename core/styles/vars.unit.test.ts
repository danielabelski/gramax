import { readFileSync } from "fs";
import { resolve } from "path";

const style = document.createElement("style");
style.textContent = readFileSync(resolve(__dirname, "vars.css"), "utf8");

beforeAll(() => document.head.append(style));
afterAll(() => style.remove());

const zIndex = (name: string) => Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue(name), 10);

describe("application layer order", () => {
	it("keeps macOS window dragging below header controls below floating panels below overlays", () => {
		expect(zIndex("--z-index-top-menu-dragable-area")).toBeLessThan(zIndex("--z-index-header-navigation"));
		expect(zIndex("--z-index-header-navigation")).toBeLessThan(zIndex("--z-index-floating-panel"));
		expect(zIndex("--z-index-floating-panel")).toBeLessThan(zIndex("--z-index-overlay"));
	});
});
