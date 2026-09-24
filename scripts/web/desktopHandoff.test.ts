import { desktopHandoffScript } from "./desktopHandoff";

const desktopScript = 'fetch("http://127.0.0.1:52055/catalog/article")';
const readDesktopScript = (path: string) => (path === "scripts/web/tryOpenInDesktop.js" ? desktopScript : "");

test("injects the desktop handoff script into production builds", () => {
	expect(desktopHandoffScript({ NODE_ENV: "test", PRODUCTION: "true" }, readDesktopScript)).toBe(
		`<script>${desktopScript}</script>`,
	);
});

test("omits the desktop handoff script when PRODUCTION is not set", () => {
	expect(desktopHandoffScript({ NODE_ENV: "test" }, readDesktopScript)).toBe("");
});

test('omits the desktop handoff script when PRODUCTION is "false"', () => {
	expect(desktopHandoffScript({ NODE_ENV: "test", PRODUCTION: "false" }, readDesktopScript)).toBe("");
});
