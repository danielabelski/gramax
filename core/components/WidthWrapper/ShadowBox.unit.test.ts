import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ShadowBox from "./ShadowBox";

const definedVariables = new Set(
	[...readFileSync(join(__dirname, "../../styles/vars.css"), "utf8").matchAll(/(--[\w-]+)\s*:/g)].map(
		([, name]) => name,
	),
);

describe("ShadowBox", () => {
	// Server markup keeps the inline style verbatim; jsdom drops a background it cannot parse.
	it.each(["left", "right"] as const)("fades the %s edge with colours that exist in the theme", (direction) => {
		const markup = renderToStaticMarkup(createElement(ShadowBox, { direction, width: 40, height: 120 }));
		const used = [...markup.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name);

		expect(markup).toContain(`linear-gradient(to ${direction}`);
		expect(used.length).toBeGreaterThan(0);
		expect(used.filter((name) => !definedVariables.has(name))).toEqual([]);
	});
});
