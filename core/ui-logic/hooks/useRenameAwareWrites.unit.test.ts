import type { ClientArticleProps } from "@core/SitePresenter/SitePresenter";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import type { ItemRenamePatch } from "@ext/navigation/NavigationEvents";
import type { PropertyService } from "@ext/properties/components/PropertyService";
import { renderHook } from "@testing-library/react";
import useRenameAwareWrites from "./useRenameAwareWrites";

// A write queued during a rename learns the new address from the rename itself. The subscription
// that also carries it is gone once the editor unmounts, and the write may still be waiting then.

const props = (path: string): ClientArticleProps =>
	({
		ref: { path, storageId: "s" },
		title: "Untitled",
		fileName: "untitled",
		logicPath: "cat/untitled",
	}) as ClientArticleProps;

const apiUrlCreator = {
	fromNewArticlePath: (path: string) => ({ path }),
} as unknown as ApiUrlCreator;

const propertyService = { articleProperties: [] } as unknown as PropertyService;

const patch: ItemRenamePatch = {
	ref: { path: "cat/alpha.md", storageId: "s" },
	pathname: "/cat/alpha",
	fileName: "alpha",
	logicPath: "cat/alpha",
	title: "Alpha",
};

describe("useRenameAwareWrites", () => {
	test("a write waiting on a rename is sent to the address the rename returned, even after unmount", async () => {
		const { result, unmount } = renderHook(() =>
			useRenameAwareWrites({
				articleProps: props("cat/untitled.md"),
				updateArticleProps: () => undefined,
				apiUrlCreator,
				propertyService,
				view: "1",
			}),
		);
		let land: (value: ItemRenamePatch) => void = () => undefined;
		const rename = new Promise<ItemRenamePatch>((resolve) => {
			land = resolve;
		});

		void result.current.trackRename(rename);
		const write = result.current.sendContext();
		unmount();
		land(patch);

		const context = await write;
		expect(context.articleProps.ref.path).toBe("cat/alpha.md");
		expect((context.apiUrlCreator as unknown as { path: string }).path).toBe("cat/alpha.md");
	});

	test("a failed rename releases the waiting write with the old address", async () => {
		const { result } = renderHook(() =>
			useRenameAwareWrites({
				articleProps: props("cat/untitled.md"),
				updateArticleProps: () => undefined,
				apiUrlCreator,
				propertyService,
				view: "1",
			}),
		);
		const rename = Promise.reject(new Error("offline"));
		void result.current.trackRename(rename).catch(() => undefined);

		const context = await result.current.sendContext();
		expect(context.articleProps.ref.path).toBe("cat/untitled.md");
	});

	test("ownPathRef follows a rename this hook performed", async () => {
		const { result } = renderHook(() =>
			useRenameAwareWrites({
				articleProps: props("cat/untitled.md"),
				updateArticleProps: () => undefined,
				apiUrlCreator,
				propertyService,
				view: "1",
			}),
		);
		expect(result.current.ownPathRef.current).toBe("cat/untitled.md");

		await result.current.trackRename(Promise.resolve(patch));

		expect(result.current.ownPathRef.current).toBe("cat/alpha.md");
	});

	// The parent can hand this same, still-mounted hook instance a different article's props without
	// this hook ever having renamed anything (see ArticleEditRenderer's own-slot-reused guard, which
	// relies on exactly this gap between articlePropsRef and ownPathRef to detect the swap).
	test("ownPathRef does not follow a props change this hook did not perform", () => {
		const { result, rerender } = renderHook(
			(currentProps: ClientArticleProps) =>
				useRenameAwareWrites({
					articleProps: currentProps,
					updateArticleProps: () => undefined,
					apiUrlCreator,
					propertyService,
					view: "1",
				}),
			{ initialProps: props("cat/untitled.md") },
		);

		rerender(props("other-cat/unrelated.md"));

		expect(result.current.articlePropsRef.current.ref.path).toBe("other-cat/unrelated.md");
		expect(result.current.ownPathRef.current).toBe("cat/untitled.md");
	});
});
