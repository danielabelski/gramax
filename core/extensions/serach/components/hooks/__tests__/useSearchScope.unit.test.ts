import { ItemType } from "@core/FileStructue/Item/ItemType";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { type UseSearchScopeArgs, useSearchScope } from "@ext/serach/components/hooks/useSearchScope";
import type { SearchScopeMode } from "@ext/serach/components/model/searchScope";
import { act, renderHook } from "@testing-library/react";

const makeItemLink = (pathname: string, type: ItemType): ItemLink =>
	({ pathname, type, ref: { path: pathname } }) as ItemLink;

const render = (overrides: Partial<UseSearchScopeArgs> = {}) =>
	renderHook((args: UseSearchScopeArgs) => useSearchScope(args), {
		initialProps: { mode: "catalog" as SearchScopeMode, isStatic: false, ...overrides },
	});

describe("useSearchScope", () => {
	describe("initial value", () => {
		it("starts at the scope each mode defaults to", () => {
			expect(render({ mode: "catalog" }).result.current.value).toBe("catalog");
			expect(render({ mode: "section" }).result.current.value).toBe("folder");
			expect(render({ mode: "homepage" }).result.current.value).toBe("all");
		});
	});

	describe("available", () => {
		it("hides the cross-catalog scope on static", () => {
			expect(render({ isStatic: true }).result.current.available).toEqual(["catalog", "article"]);
			expect(render({ mode: "section", isStatic: true }).result.current.available).toEqual(["folder"]);
		});
	});

	describe("set", () => {
		it("applies a new scope", () => {
			const { result } = render();

			act(() => result.current.set("article"));

			expect(result.current.value).toBe("article");
		});
	});

	describe("mode change", () => {
		it("resets to the new mode default", () => {
			const { result, rerender } = render();
			act(() => result.current.set("article"));

			rerender({ mode: "section", isStatic: false });

			expect(result.current.value).toBe("folder");
		});
	});

	describe("cycle", () => {
		it("walks catalog scopes in order and wraps around", () => {
			const { result } = render();

			act(() => result.current.cycle());
			expect(result.current.value).toBe("article");

			act(() => result.current.cycle());
			expect(result.current.value).toBe("all");

			act(() => result.current.cycle());
			expect(result.current.value).toBe("catalog");
		});

		it("toggles between the two section scopes", () => {
			const { result } = render({ mode: "section" });

			act(() => result.current.cycle());
			expect(result.current.value).toBe("all");

			act(() => result.current.cycle());
			expect(result.current.value).toBe("folder");
		});

		it("skips the cross-catalog scope on static", () => {
			const { result } = render({ isStatic: true });

			act(() => result.current.cycle());
			expect(result.current.value).toBe("article");

			act(() => result.current.cycle());
			expect(result.current.value).toBe("catalog");
		});

		it("stays on all in homepage mode", () => {
			const { result } = render({ mode: "homepage" });

			act(() => result.current.cycle());

			expect(result.current.value).toBe("all");
		});
	});

	describe("isCategory", () => {
		it("is true when the current article is a category", () => {
			const itemLinks = [makeItemLink("docs/a", ItemType.category)];
			const { result } = render({ itemLinks, currentArticleRefPath: "docs/a" });

			expect(result.current.isCategory).toBe(true);
		});

		it("is false for an article and without item links", () => {
			const itemLinks = [makeItemLink("docs/a", ItemType.article)];

			expect(render({ itemLinks, currentArticleRefPath: "docs/a" }).result.current.isCategory).toBe(false);
			expect(render({ currentArticleRefPath: "docs/a" }).result.current.isCategory).toBe(false);
		});
	});

	describe("showCatalogBreadcrumb", () => {
		it("is on only for the cross-catalog scopes", () => {
			const { result } = render();
			expect(result.current.showCatalogBreadcrumb).toBe(false);

			act(() => result.current.set("all"));
			expect(result.current.showCatalogBreadcrumb).toBe(true);

			act(() => result.current.set("article"));
			expect(result.current.showCatalogBreadcrumb).toBe(false);
		});

		it("is on for a section folder scope", () => {
			expect(render({ mode: "section" }).result.current.showCatalogBreadcrumb).toBe(true);
		});
	});
});
