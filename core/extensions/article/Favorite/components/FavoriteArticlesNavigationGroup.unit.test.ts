import { ItemType } from "@core/FileStructue/Item/ItemType";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { FavoriteArticlesNavigationGroup } from "./FavoriteArticlesNavigationGroup";

const items = [
	{ type: ItemType.article, title: "First article", pathname: "/catalog/first", ref: { path: "first.md" } },
	{
		type: ItemType.article,
		title: "Second article",
		pathname: "/catalog/second",
		ref: { path: "second.md" },
		isCurrentLink: true,
	},
] as ItemLink[];

const renderGroup = (props: { catalogName?: string; items: ItemLink[] }) =>
	render(createElement(TooltipProvider, null, createElement(FavoriteArticlesNavigationGroup, props)));

describe("FavoriteArticlesNavigationGroup", () => {
	beforeEach(() => window.localStorage.clear());

	test("does not render a group without favorite articles", () => {
		const { container } = renderGroup({ items: [] });

		expect(container.innerHTML).toBe("");
	});

	test("renders favorite articles in a collapsible read-only group", () => {
		renderGroup({ items });

		const groupButton = screen.getByRole("button", { name: /favorite articles/i });
		const firstArticle = screen.getByRole("link", { name: "First article" });
		const secondArticle = screen.getByRole("link", { name: "Second article" });
		expect(firstArticle.getAttribute("href")).toBe("/catalog/first");
		expect(secondArticle.getAttribute("href")).toBe("/catalog/second");
		expect(secondArticle.getAttribute("data-active")).toBe("true");
		expect(within(firstArticle).queryByTestId("article-actions")).toBeNull();
		expect(within(secondArticle).getByTestId("article-actions")).toBeTruthy();

		fireEvent.pointerEnter(firstArticle);
		expect(within(firstArticle).getByTestId("article-actions")).toBeTruthy();
		fireEvent.pointerLeave(firstArticle);
		fireEvent.pointerEnter(secondArticle);
		expect(within(secondArticle).getByTestId("article-actions")).toBeTruthy();
		expect(groupButton.closest("[data-favorite-articles-group]")?.getAttribute("draggable")).not.toBe("true");

		fireEvent.click(groupButton);

		expect(screen.getByTestId("favorite-articles-content").getAttribute("data-state")).toBe("closed");
	});

	test("restores collapsed state after the navigation remounts", () => {
		const firstRender = renderGroup({ catalogName: "catalog", items });
		fireEvent.click(screen.getByRole("button", { name: /favorite articles/i }));
		expect(screen.getByTestId("favorite-articles-content").getAttribute("data-state")).toBe("closed");
		firstRender.unmount();

		renderGroup({ catalogName: "catalog", items });

		expect(screen.getByTestId("favorite-articles-content").getAttribute("data-state")).toBe("closed");
	});

	test("does not navigate when article actions are clicked", () => {
		renderGroup({ items });
		const firstArticle = screen.getByRole("link", { name: "First article" });
		fireEvent.pointerEnter(firstArticle);
		const actionsButton = within(firstArticle).getByTestId("article-actions");
		const clickEvent = createEvent.click(actionsButton);

		fireEvent(actionsButton, clickEvent);

		expect(clickEvent.defaultPrevented).toBe(true);
	});
});
