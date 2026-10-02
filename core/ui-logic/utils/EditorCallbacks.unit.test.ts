import type { Router } from "@core/Api/Router";
import type { ClientArticleProps } from "@core/SitePresenter/SitePresenter";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import type { BaseEditorContext } from "@core-ui/stores/EditorStore";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import { createUpdateTitleFunction } from "./EditorCallbacks";

// biome-ignore lint/style/useNamingConvention: Jest module mock shape
jest.mock("@core-ui/ApiServices/FetchService", () => ({ __esModule: true, default: { fetch: jest.fn() } }));

const fetchMock = FetchService.fetch as jest.Mock;

const articleProps = (): ClientArticleProps =>
	({
		ref: { path: "cat/a.md", storageId: "s" },
		pathname: "/cat/a",
		title: "Old title",
		fileName: "a",
		logicPath: "cat/a",
	}) as ClientArticleProps;

const apiUrlCreator = {
	updateItemProps: () => "update-url",
	getArticleBrotherFileNames: () => "brothers-url",
} as unknown as ApiUrlCreator;

const router = { pushPath: jest.fn() } as unknown as Router;

describe("createUpdateTitleFunction", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		(router.pushPath as jest.Mock).mockReset();
	});

	test.each([null, undefined, ""])(
		"an empty title over a stub with title %p writes nothing (it would put an empty file on disk)",
		async (stubTitle) => {
			const updateTitle = createUpdateTitleFunction();
			const props = {
				...articleProps(),
				title: stubTitle,
				external: "Первая таблица",
			} as unknown as ClientArticleProps;
			const context: BaseEditorContext = { apiUrlCreator, articleProps: props, view: "1" };

			const patch = await updateTitle(context, router, "");

			expect(patch).toBeUndefined();
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	test("an ordinary title edit (no rename) still tells the sidebar the title changed", async () => {
		fetchMock.mockResolvedValue({ ok: true });
		const updateTitle = createUpdateTitleFunction();
		const context: BaseEditorContext = { apiUrlCreator, articleProps: articleProps(), view: "1" };

		const events: unknown[] = [];
		const token = NavigationEvents.on("item-rename", (event) => {
			events.push(event);
		});

		const patch = await updateTitle(context, router, "New title");

		NavigationEvents.off(token);

		expect(patch).toEqual({
			ref: { path: "cat/a.md", storageId: "s" },
			pathname: "/cat/a",
			fileName: "a",
			logicPath: "cat/a",
			title: "New title",
		});
		expect(events).toHaveLength(1);
		expect(router.pushPath).not.toHaveBeenCalled();
	});

	test("a failed request emits nothing", async () => {
		fetchMock.mockResolvedValue({ ok: false });
		const updateTitle = createUpdateTitleFunction();
		const context: BaseEditorContext = { apiUrlCreator, articleProps: articleProps(), view: "1" };

		const events: unknown[] = [];
		const token = NavigationEvents.on("item-rename", (event) => {
			events.push(event);
		});

		const patch = await updateTitle(context, router, "New title");

		NavigationEvents.off(token);

		expect(patch).toBeUndefined();
		expect(events).toHaveLength(0);
	});
});
