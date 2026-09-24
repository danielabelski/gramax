import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { Collapsible } from "@ui-kit/Collapsible";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { JSDOM } from "jsdom";
import { createElement, type MouseEventHandler, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadonlyFolderItem } from "./ReadonlyFolderItem";

jest.mock("@components/Atoms/Link", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest uses this marker for default-export interop.
	__esModule: true,
	default: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => {
		const React = jest.requireActual<typeof import("react")>("react");
		return React.createElement("a", { href: "/catalog/folder", onClick }, children);
	},
}));

jest.mock("@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationTreeItemActions", () => ({
	NavigationTreeItemActions: () => {
		const React = jest.requireActual<typeof import("react")>("react");
		return React.createElement("span", { "data-testid": "actions" });
	},
}));

const folder = {
	title: "Folder",
	pathname: "/catalog/folder",
	ref: { path: "catalog/folder/_index.yaml" },
} as ItemLink;

test("keeps the collapse trigger beside the title without nesting buttons", () => {
	const markup = renderToStaticMarkup(
		createElement(
			TooltipProvider,
			null,
			createElement(
				Collapsible,
				{ open: true },
				createElement(ReadonlyFolderItem, {
					data: folder,
					isNested: false,
					isSelected: false,
					level: 1,
					onClick: jest.fn(),
					open: true,
				}),
			),
		),
	);
	const item = new JSDOM(markup).window.document.querySelector("li");
	const row = item?.firstElementChild;
	const trigger = item?.querySelector("button[data-collapsible-trigger]");

	expect(item?.parentElement?.tagName).toBe("A");
	expect(item?.children).toHaveLength(1);
	expect(row?.tagName).toBe("DIV");
	expect(Array.from(row?.children ?? []).map((child) => child.tagName)).toEqual(["SPAN", "SPAN"]);
	expect(trigger).not.toBeNull();
	expect(row?.firstElementChild?.contains(trigger ?? null)).toBe(true);
	expect(item?.querySelector("button button")).toBeNull();
});
