/** biome-ignore-all lint/suspicious/noExplicitAny: the stubs stand in for whole subsystems */
import "@core/utils/asyncUtils";
import { DEFAULT_LFS_EXCLUDE } from "@core/GitLfs/logic/autoLfsAttachments";
import type { ClientCatalogProps } from "@core/SitePresenter/SitePresenter";
import type { LfsAutoAttachmentsDialogProps } from "@ext/git/actions/Sync/components/LfsAutoAttachmentsDialog";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import type { FormData } from "./createFormSchema";

const mockFetch = jest.fn();
jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

const mockApiUrlCreator = {
	getCustomIconsList: () => "icons-url",
	getCatalogBrotherFileNames: () => "names-url",
	updateCatalogProps: () => "props-url",
	deleteCustomIcon: () => "delete-icon-url",
	createCustomIcon: () => "create-icon-url",
	getAttachmentsMigrationStats: () => "stats-url",
	enableAutoLfsAttachments: () => "enable-url",
};
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		get value() {
			return mockApiUrlCreator;
		},
	},
}));

let mockCatalogData: any;
const mockUpdateCatalogPropsStore = jest.fn();
jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (s: unknown) => unknown) =>
		selector({ data: mockCatalogData, update: mockUpdateCatalogPropsStore }),
}));

jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: (selector: (s: unknown) => unknown) => selector({ data: { logicPath: "logic/path" } }),
}));

jest.mock("@core-ui/ContextServices/CatalogLogoService/Context", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		value: () => ({ darkLogo: "", lightLogo: "", refreshState: jest.fn(), refreshLogo: jest.fn() }),
	},
}));

jest.mock("@core/Api/useRouter", () => ({ useRouter: () => ({ path: "/catalog", pushPath: jest.fn() }) }));

jest.mock("@core/RouterPath/RouterPathProvider", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		parseItemLogicPath: () => ({ filePath: [] }),
		isEditorPathname: () => false,
		updatePathnameData: (path: unknown) => path,
	},
}));

const mockAddModal = jest.fn((..._args: unknown[]) => "modal-id");
const mockRemoveModal = jest.fn((..._args: unknown[]) => undefined);
jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		addModal: (...args: unknown[]) => mockAddModal(...args),
		removeModal: (...args: unknown[]) => mockRemoveModal(...args),
	},
}));

const mockNotify = jest.fn();
jest.mock("@ext/errorHandlers/client/ErrorConfirmService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { notify: (...args: unknown[]) => mockNotify(...args) },
}));

jest.mock("@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeConflict", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: jest.fn(),
}));

const mockGetLfsOptions = jest.fn();
const mockUpdateLfsOptions = jest.fn();
let mockLfsAllowed = true;
jest.mock("@core/GitLfs/hooks/useEditLfsOptions", () => ({
	useEditLfsOptions: () => ({
		getLfsOptions: mockGetLfsOptions,
		updateLfsOptions: mockUpdateLfsOptions,
		allowed: mockLfsAllowed,
		isLoading: false,
	}),
}));

import { useCatalogPropsEditorActions } from "./useCatalogPropsEditorActions";

const clientProps = (lfs?: unknown, extra?: Record<string, unknown>): ClientCatalogProps =>
	({
		title: "Catalog",
		name: "catalog",
		link: { pathname: "/catalog" },
		properties: [],
		...(lfs === undefined ? {} : { lfs }),
		...extra,
	}) as unknown as ClientCatalogProps;

const formStub = (values: { exclude?: string[]; patterns?: string[] } = {}) =>
	({
		setValue: jest.fn(),
		getValues: jest.fn((field: string) => (field === "lfs.patterns" ? values.patterns : values.exclude)),
	}) as unknown as UseFormReturn<FormData> & { setValue: jest.Mock; getValues: jest.Mock };

// The form resolves its `defaultValues` through `getOriginalProps` before it renders anything,
// so every state the hook derives from that read is already settled by the time a switch is clickable.
const render = async () => {
	const hook = renderHook(() => useCatalogPropsEditorActions(jest.fn()));
	await waitFor(() => expect(mockFetch).toHaveBeenCalled());
	await act(async () => {
		await hook.result.current.getOriginalProps();
	});
	return hook;
};

const openedDialogProps = (): LfsAutoAttachmentsDialogProps => mockAddModal.mock.calls[0][1] as never;

const STATS = { fileCount: 2, totalSize: 2048, added: ["*.png"] };

const toggleOn = async (
	result: { current: ReturnType<typeof useCatalogPropsEditorActions> },
	form: UseFormReturn<FormData>,
) => {
	await act(async () => {
		result.current.onToggleAutoLfs(form)(true);
	});
};

const fetchedUrls = () => mockFetch.mock.calls.map((call) => call[0] as string);

beforeEach(() => {
	jest.clearAllMocks();
	mockLfsAllowed = true;
	mockCatalogData = clientProps();
	mockGetLfsOptions.mockResolvedValue({ patterns: ["*.pdf"], lazy: true });
	mockFetch.mockImplementation(async (url: string) => {
		if (url === "icons-url") return { ok: true, json: async () => [] };
		if (url === "names-url") return { ok: true, json: async () => [] };
		if (url === "stats-url") return { ok: true, json: async () => STATS };
		if (url === "enable-url")
			return { ok: true, json: async () => ({ migrated: true, mergeData: { ok: true }, patterns: [] }) };
		return { ok: true, json: async () => ({ link: { pathname: "/catalog" } }) };
	});
});

describe("useCatalogPropsEditorActions: exclusion seeding", () => {
	it("seeds the lazy download mode from the repository configuration", async () => {
		mockGetLfsOptions.mockResolvedValue({ patterns: ["*.pdf"], lazy: false });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.lazy).toBe(false);
	});

	it("seeds no extras when the catalog has no lfs block at all — the defaults are not stored", async () => {
		mockCatalogData = clientProps();
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.exclude).toEqual([]);
	});

	it("hides the defaults a catalog written before they were implicit still carries", async () => {
		mockCatalogData = clientProps({ auto: true, exclude: [...DEFAULT_LFS_EXCLUDE, "*.gif"] });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.exclude).toEqual(["*.gif"]);
	});

	it("seeds an empty list when an lfs block exists without exclusions", async () => {
		mockCatalogData = clientProps({ auto: false });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.exclude).toEqual([]);
	});

	it("keeps a deliberately cleared list empty", async () => {
		mockCatalogData = clientProps({ auto: true, exclude: [] });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.exclude).toEqual([]);
	});

	it("keeps a stored list untouched", async () => {
		mockCatalogData = clientProps({ auto: true, exclude: ["*.gif"] });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).lfs.exclude).toEqual(["*.gif"]);
	});
});

describe("useCatalogPropsEditorActions: icon logo default value", () => {
	it("seeds a null color for a stored icon logo that carries no color, not undefined", async () => {
		mockCatalogData = clientProps(undefined, { logo: "icon:arrow-up-0-1" });
		const { result } = await render();

		expect((await result.current.getOriginalProps()).logo.light).toEqual({
			type: "icon",
			code: "arrow-up-0-1",
			color: null,
		});
	});
});

describe("useCatalogPropsEditorActions: auto-LFS confirmation", () => {
	it("adds the masks the enable reported to the form's list", async () => {
		const { result } = await render();
		const form = formStub();

		await toggleOn(result, form);
		act(() => openedDialogProps().onSettled(true, { ok: true }, ["*.pdf", "*.png"]));

		expect(form.setValue).toHaveBeenCalledWith("lfs.patterns", ["*.pdf", "*.png"], { shouldDirty: false });
	});

	it("keeps a mask the form holds but the enable never saw", async () => {
		const { result } = await render();
		const form = formStub({ patterns: ["*.zip"] });

		await toggleOn(result, form);
		act(() => openedDialogProps().onSettled(true, { ok: true }, ["*.pdf", "*.png"]));

		expect(form.setValue).toHaveBeenCalledWith("lfs.patterns", ["*.zip", "*.pdf", "*.png"], {
			shouldDirty: false,
		});
	});

	it("does not duplicate a mask both sides already know", async () => {
		const { result } = await render();
		const form = formStub({ patterns: ["*.zip", "*.pdf"] });

		await toggleOn(result, form);
		act(() => openedDialogProps().onSettled(true, { ok: true }, ["*.pdf", "*.png"]));

		expect(form.setValue).toHaveBeenCalledWith("lfs.patterns", ["*.zip", "*.pdf", "*.png"], {
			shouldDirty: false,
		});
	});

	it("leaves the mask list alone when the enable reported none", async () => {
		const { result } = await render();
		const form = formStub();

		await toggleOn(result, form);
		act(() => openedDialogProps().onSettled(false, { ok: true }, undefined));

		expect(form.setValue).not.toHaveBeenCalledWith("lfs.patterns", expect.anything(), expect.anything());
	});
});

describe("useCatalogPropsEditorActions: the check before the confirmation", () => {
	it("checks first and hands the answer to the dialog instead of letting it fetch again", async () => {
		const { result } = await render();
		const form = formStub({ exclude: ["*.svg"] });

		await toggleOn(result, form);

		expect(mockAddModal).toHaveBeenCalledTimes(1);
		expect(openedDialogProps().stats).toEqual(STATS);
		expect(fetchedUrls().filter((url) => url === "stats-url")).toHaveLength(1);
		const statsCall = mockFetch.mock.calls.find((call) => call[0] === "stats-url");
		expect(JSON.parse(statsCall[1] as string)).toEqual({ exclude: ["*.svg"] });
	});

	it("enables silently when the check reports nothing to add", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (url === "stats-url") return { ok: true, json: async () => ({ fileCount: 0, totalSize: 0, added: [] }) };
			if (url === "enable-url")
				return {
					ok: true,
					json: async () => ({ migrated: true, mergeData: { ok: true }, patterns: ["*.png"] }),
				};
			return { ok: true, json: async () => [] };
		});
		const { result } = await render();
		const form = formStub();

		await toggleOn(result, form);

		expect(mockAddModal).not.toHaveBeenCalled();
		expect(fetchedUrls()).toContain("enable-url");
		expect(form.setValue).toHaveBeenCalledWith("lfs.auto", true, { shouldDirty: false });
	});

	it("leaves the switch off when the silent enable did not save", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (url === "stats-url") return { ok: true, json: async () => ({ fileCount: 0, totalSize: 0, added: [] }) };
			if (url === "enable-url")
				return { ok: true, json: async () => ({ migrated: false, mergeData: { ok: true } }) };
			return { ok: true, json: async () => [] };
		});
		const { result } = await render();
		const form = formStub();

		await toggleOn(result, form);

		expect(form.setValue).not.toHaveBeenCalledWith("lfs.auto", true, expect.anything());
	});

	it("leaves the switch off and asks nothing when the check itself failed", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (url === "stats-url") return { ok: false, json: async () => ({}) };
			return { ok: true, json: async () => [] };
		});
		const { result } = await render();
		const form = formStub();

		await toggleOn(result, form);

		expect(mockAddModal).not.toHaveBeenCalled();
		expect(fetchedUrls()).not.toContain("enable-url");
		expect(form.setValue).not.toHaveBeenCalledWith("lfs.auto", true, expect.anything());
	});

	it("clears the checking flag on every exit", async () => {
		const { result } = await render();

		await toggleOn(result, formStub());
		expect(result.current.autoLfsChecking).toBe(false);

		act(() => openedDialogProps().onSettled(false));

		mockFetch.mockImplementation(async (url: string) => {
			if (url === "stats-url") return { ok: false, json: async () => ({}) };
			return { ok: true, json: async () => [] };
		});
		await toggleOn(result, formStub());
		expect(result.current.autoLfsChecking).toBe(false);

		mockFetch.mockImplementation(async (url: string) => {
			if (url === "stats-url") return { ok: true, json: async () => ({ fileCount: 0, totalSize: 0, added: [] }) };
			return { ok: true, json: async () => ({ migrated: true, mergeData: { ok: true }, patterns: [] }) };
		});
		await toggleOn(result, formStub());
		expect(result.current.autoLfsChecking).toBe(false);
	});
});

describe("useCatalogPropsEditorActions: enabling on an unread LFS state", () => {
	const expectRefused = async (result: { current: ReturnType<typeof useCatalogPropsEditorActions> }) => {
		const form = formStub();

		await toggleOn(result, form);

		expect(result.current.lfsKnown).toBe(false);
		expect(fetchedUrls()).not.toContain("stats-url");
		expect(fetchedUrls()).not.toContain("enable-url");
		expect(mockAddModal).not.toHaveBeenCalled();
		expect(form.setValue).not.toHaveBeenCalledWith("lfs.auto", true, expect.anything());
	};

	it("refuses to enable when the mask list could not be read", async () => {
		mockGetLfsOptions.mockResolvedValue(null);
		const { result } = await render();

		await expectRefused(result);
	});

	it("refuses to enable when the icons fetch failed and the read never got that far", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (url === "icons-url") return { ok: false, json: async () => [] };
			return { ok: true, json: async () => [] };
		});
		const { result } = await render();

		await expectRefused(result);
	});

	it("enables normally once the state is known", async () => {
		const { result } = await render();

		expect(result.current.lfsKnown).toBe(true);
		await toggleOn(result, formStub());

		expect(mockAddModal).toHaveBeenCalledTimes(1);
	});
});

describe("useCatalogPropsEditorActions: partial original props", () => {
	const sentProps = () => JSON.parse(mockFetch.mock.calls.find((call) => call[0] === "props-url")[1] as string);

	const submit = async (
		result: { current: ReturnType<typeof useCatalogPropsEditorActions> },
		defaultValues?: any,
	) => {
		const newProps = {
			title: "Catalog",
			icons: [],
			lfs: { patterns: [], lazy: false, auto: false, exclude: [] },
		} as any;
		await act(async () => {
			await result.current.onSubmit(newProps, defaultValues ?? { ...newProps });
		});
	};

	it("omits the whole lfs half of the save when the icons fetch failed", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (url === "icons-url") return { ok: false, json: async () => [] };
			if (url === "names-url") return { ok: true, json: async () => [] };
			return { ok: true, json: async () => ({ link: { pathname: "/catalog" } }) };
		});
		const { result } = await render();

		await submit(result);

		expect(mockUpdateLfsOptions).not.toHaveBeenCalled();
		expect(sentProps()).not.toHaveProperty("lfs");
	});

	it("omits the lfs half when the form's defaults never carried an lfs block", async () => {
		const { result } = await render();

		await submit(result, { title: "Catalog", icons: [] });

		expect(mockUpdateLfsOptions).not.toHaveBeenCalled();
		expect(sentProps()).not.toHaveProperty("lfs");
	});

	it("omits the lfs half when the mask list could not be read", async () => {
		mockGetLfsOptions.mockResolvedValue(null);
		const { result } = await render();

		await submit(result);

		expect(mockUpdateLfsOptions).not.toHaveBeenCalled();
		expect(sentProps()).not.toHaveProperty("lfs");
	});

	it("saves the lfs half normally when the original props are complete", async () => {
		const { result } = await render();

		await submit(result);

		expect(mockUpdateLfsOptions).toHaveBeenCalledWith({ patterns: [], lazy: false });
		expect(sentProps().lfs).toEqual({ auto: false, exclude: [] });
	});
});
