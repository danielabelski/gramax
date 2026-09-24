/**
 * @jest-environment node
 */
import type { Section } from "@core/SitePresenter/SitePresenter";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import Style from "../Cards/model/Style";
import { buildState } from "../utils/homeLayoutBuilders";
import {
	canNavigateHomeFolder,
	type HomeFolder,
	type HomeSections,
	isHomeFolder,
	NEW_SECTION_KEY,
	UNCATEGORIZED_ID,
} from "../utils/homeLayoutTypes";
import { selectHomeSections, useHomepageLayoutStore } from "./homepageLayoutStore";

const emptySection: Section = { title: "root", href: "/", catalogLinks: [] };

const sectionsWithIds = (...ids: string[]): HomeSections => ids.map((id) => ({ id, items: [] }));
const setSections = (...ids: string[]) => useHomepageLayoutStore.getState().setSections(sectionsWithIds(...ids));
const sectionIds = () => selectHomeSections(useHomepageLayoutStore.getState()).map((section) => section.id);

const sectionsWithFolder = (items: string[]): HomeSections => [
	{ id: "main", items: [{ type: "folder", id: "folder", title: "Folder", items }] },
];

const catalogLink = (name: string, title: string): CatalogLink => ({
	name,
	title,
	pathname: `/${name}`,
	logo: "",
	style: Style.blue,
	group: "",
	order: 0,
	description: "",
});

const initialState = useHomepageLayoutStore.getState();

beforeEach(() => {
	useHomepageLayoutStore.setState(initialState, true);
});

describe("homepageLayoutStore undo/redo history", () => {
	test("does not keep active sections as a duplicated top-level state field", () => {
		useHomepageLayoutStore.getState().init(emptySection);

		expect(useHomepageLayoutStore.getState()).not.toHaveProperty("sections");
	});

	test("reads sections from the active view", () => {
		useHomepageLayoutStore.setState({
			activeView: "global",
			views: {
				global: { sections: sectionsWithIds("global-section") },
				personal: { sections: sectionsWithIds("personal-section") },
			},
		});

		expect(sectionIds()).toEqual(["global-section"]);

		useHomepageLayoutStore.getState().setActiveView("personal");

		expect(sectionIds()).toEqual(["personal-section"]);
	});

	test("initializes global and personal views from different sections", () => {
		useHomepageLayoutStore.getState().init(
			{
				...emptySection,
				sections: { global: { ...emptySection, title: "Global", view: WorkspaceView.section } },
			},
			{
				...emptySection,
				sections: { personal: { ...emptySection, title: "Personal", view: WorkspaceView.section } },
			},
		);

		expect(useHomepageLayoutStore.getState().views.global.sections[0].id).toBe("global");
		expect(useHomepageLayoutStore.getState().views.personal.sections[0].id).toBe("personal");
	});

	test("records which view has a catalog duplicated in the layout visible to the UI", () => {
		const shared = catalogLink("shared", "Shared");

		useHomepageLayoutStore.getState().init(
			{
				...emptySection,
				sections: {
					a: { ...emptySection, title: "A", view: WorkspaceView.section, catalogLinks: [shared] },
					b: { ...emptySection, title: "B", view: WorkspaceView.section, catalogLinks: [shared] },
				},
			},
			emptySection,
		);

		expect(useHomepageLayoutStore.getState().duplicateCatalogByScope).toEqual({ global: true, personal: false });
	});

	test("does not enter edit mode for a view with catalogs duplicated across sections", () => {
		useHomepageLayoutStore.setState({ duplicateCatalogByScope: { global: true, personal: false } });

		useHomepageLayoutStore.getState().beginEdit("global");

		expect(useHomepageLayoutStore.getState().editScope).toBeNull();
	});

	test("does not reset the draft when page data is refreshed during edit mode", () => {
		useHomepageLayoutStore.getState().init(emptySection, emptySection, false, "first-workspace");
		useHomepageLayoutStore.getState().beginEdit("global");
		setSections("draft");

		useHomepageLayoutStore.getState().init(emptySection, emptySection, false, "first-workspace");

		expect(sectionIds()).toEqual(["draft"]);
	});

	test("drops the draft when the active workspace changes", () => {
		useHomepageLayoutStore.getState().init(emptySection, emptySection, false, "first-workspace");
		useHomepageLayoutStore.getState().beginEdit("global");
		setSections("draft");

		useHomepageLayoutStore.getState().init(
			{
				...emptySection,
				sections: { fresh: { ...emptySection, title: "Fresh", view: WorkspaceView.section } },
			},
			emptySection,
			false,
			"second-workspace",
		);

		expect(useHomepageLayoutStore.getState().editScope).toBeNull();
		expect(sectionIds()).toEqual(["fresh", UNCATEGORIZED_ID]);
	});

	test("updates inherited personal view when a global edit is committed", () => {
		useHomepageLayoutStore.getState().init(emptySection, emptySection, false);
		useHomepageLayoutStore.getState().beginEdit("global");
		setSections("changed-global");

		useHomepageLayoutStore.getState().commitEdit();

		expect(useHomepageLayoutStore.getState().views.personal.sections).toEqual(sectionsWithIds("changed-global"));
	});

	test("preserves an overridden personal view when a global edit is committed", () => {
		useHomepageLayoutStore.getState().init(emptySection, emptySection, true);
		useHomepageLayoutStore.getState().beginEdit("global");
		setSections("changed-global");

		useHomepageLayoutStore.getState().commitEdit();

		expect(useHomepageLayoutStore.getState().views.personal.sections).toEqual([
			{ id: UNCATEGORIZED_ID, items: [] },
		]);
	});

	test("does not create a personal override when editing made no changes", () => {
		useHomepageLayoutStore.getState().init(emptySection, emptySection, false);
		useHomepageLayoutStore.getState().beginEdit("personal");

		useHomepageLayoutStore.getState().commitEdit();

		expect(useHomepageLayoutStore.getState().hasPersonalOverride).toBe(false);
	});

	test("cancelEdit restores the active view without recreating top-level sections", () => {
		useHomepageLayoutStore.getState().init(emptySection);
		useHomepageLayoutStore.getState().beginEdit("global");
		setSections("changed");

		useHomepageLayoutStore.getState().cancelEdit();

		expect(sectionIds()).toEqual([UNCATEGORIZED_ID]);
		expect(useHomepageLayoutStore.getState()).not.toHaveProperty("sections");
	});

	test("a layout mutation pushes exactly one history snapshot", () => {
		setSections("a", "b");
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);

		setSections("b", "a");
		expect(useHomepageLayoutStore.getState().history).toHaveLength(2);
	});

	test("undo() restores the previous order", () => {
		setSections("a", "b");
		setSections("b", "a");

		useHomepageLayoutStore.getState().undo();

		expect(sectionIds()).toEqual(["a", "b"]);
	});

	test("redo() re-applies a change that was just undone", () => {
		setSections("a", "b");
		setSections("b", "a");
		useHomepageLayoutStore.getState().undo();

		useHomepageLayoutStore.getState().redo();

		expect(sectionIds()).toEqual(["b", "a"]);
		expect(useHomepageLayoutStore.getState().future).toHaveLength(0);
	});

	test("a new change after undo drops the redo stack", () => {
		setSections("a", "b");
		setSections("b", "a");
		useHomepageLayoutStore.getState().undo();
		expect(useHomepageLayoutStore.getState().future).toHaveLength(1);

		setSections("c", "d");

		expect(useHomepageLayoutStore.getState().future).toHaveLength(0);
		expect(useHomepageLayoutStore.getState().canRedo()).toBe(false);
	});

	test("setting a new sections reference with the same content does not record a layout change", () => {
		setSections("a", "b");
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);

		setSections("a", "b");

		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);
	});

	test("setting sections with different content records the layout change", () => {
		setSections("a", "b");
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);

		setSections("a", "c");

		expect(useHomepageLayoutStore.getState().history).toHaveLength(2);
	});

	test("a mutator that returns the active sections reference does not push a history snapshot", () => {
		setSections("a", "b");
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);

		useHomepageLayoutStore.getState().deleteGroup("missing");

		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);
	});

	test("reordering a folder into the order it already has does not push a history snapshot", () => {
		useHomepageLayoutStore.getState().setSections(sectionsWithFolder(["first", "second"]));
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);

		useHomepageLayoutStore.getState().reorderFolderItems("main", "folder", ["first", "second"]);

		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);
	});

	test("removing a catalog the folder does not contain changes nothing", () => {
		useHomepageLayoutStore.getState().setSections(sectionsWithFolder(["first", "second"]));

		useHomepageLayoutStore.getState().removeFromFolder("main", "folder", "not-in-folder");

		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);
		expect(selectHomeSections(useHomepageLayoutStore.getState())).toEqual(sectionsWithFolder(["first", "second"]));
	});

	test.each<[string, () => void]>([
		["beginEdit", () => useHomepageLayoutStore.getState().beginEdit("global")],
		["commitEdit", () => useHomepageLayoutStore.getState().commitEdit()],
		["cancelEdit", () => useHomepageLayoutStore.getState().cancelEdit()],
		["init", () => useHomepageLayoutStore.getState().init(emptySection)],
	])("%s clears the undo/redo history", (_name, action) => {
		setSections("a", "b");
		setSections("b", "a");
		useHomepageLayoutStore.getState().undo();
		expect(useHomepageLayoutStore.getState().history.length).toBeGreaterThan(0);
		expect(useHomepageLayoutStore.getState().future.length).toBeGreaterThan(0);

		action();

		expect(useHomepageLayoutStore.getState().history).toHaveLength(0);
		expect(useHomepageLayoutStore.getState().future).toHaveLength(0);
	});
});

describe("undoing a real editing session", () => {
	const store = () => useHomepageLayoutStore.getState();

	/** A section holding one folder of two catalogs, plus a loose card next to it. */
	const startingLayout = (): HomeSections => [
		{
			id: "docs",
			title: "Docs",
			items: [
				{ type: "folder", id: "folder", title: "Guides", items: ["x", "y"] },
				{ type: "catalog", name: "a" },
			],
		},
		{ id: UNCATEGORIZED_ID, items: [] },
	];

	const layoutNow = () => selectHomeSections(useHomepageLayoutStore.getState());

	test("stepping back through four different edits returns the exact starting layout", () => {
		store().setSections(startingLayout());
		const before = layoutNow();

		store().setGroupTitle("docs", "Renamed");
		store().renameFolder("folder", "Renamed folder");
		// renaming re-slugs ids for both the section and the folder — read them back rather than assuming the originals
		const renamed = layoutNow().find((section) => section.items.some(isHomeFolder));
		store().removeFromFolder(renamed?.id as string, renamed?.items.find(isHomeFolder)?.id as string, "x");
		store().addGroup();
		expect(layoutNow()).not.toEqual(before);

		for (let i = 0; i < 4; i++) store().undo();

		expect(layoutNow()).toEqual(before);
		// one step is still there: the setSections that installed the starting layout in the first place
		expect(useHomepageLayoutStore.getState().history).toHaveLength(1);
	});

	test("redoing the whole chain lands back on the edited layout", () => {
		store().setSections(startingLayout());
		store().setGroupTitle("docs", "Renamed");
		store().deleteFolder("folder");
		const edited = layoutNow();

		store().undo();
		store().undo();
		store().redo();
		store().redo();

		expect(layoutNow()).toEqual(edited);
		expect(store().canRedo()).toBe(false);
	});

	test("an edit made mid-history rewrites the future instead of branching", () => {
		store().setSections(startingLayout());
		store().setGroupTitle("docs", "Renamed");
		store().deleteFolder("folder");

		store().undo();
		store().addGroup();

		expect(store().canRedo()).toBe(false);
		expect(layoutNow().some((section) => section.id === NEW_SECTION_KEY)).toBe(true);
		// the folder deletion is unreachable now — it was dropped together with the redo stack
		expect(layoutNow().some((section) => section.items.some((item) => item.type === "folder"))).toBe(true);
	});

	test("a mutation that changes nothing does not consume an undo step", () => {
		store().setSections(startingLayout());
		store().setGroupTitle("docs", "Renamed");
		const historyDepth = useHomepageLayoutStore.getState().history.length;

		const renamedSectionId = layoutNow().find((section) => section.items.some(isHomeFolder))?.id as string;

		store().renameFolder("folder", "Guides");
		store().removeFromFolder(renamedSectionId, "folder", "not-there");
		store().deleteGroup("no-such-section");

		expect(useHomepageLayoutStore.getState().history).toHaveLength(historyDepth);

		store().undo();

		expect(layoutNow().find((section) => section.id === "docs")?.title).toBe("Docs");
	});
});

describe("buildState", () => {
	test("uses the section's layout tree order", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [],
			sections: {
				docs: {
					title: "Docs",
					href: "/docs",
					view: WorkspaceView.section,
					catalogLinks: [catalogLink("api", "API"), catalogLink("onboarding", "Onboarding")],
					sections: {
						guides: { title: "Guides", href: "/docs/guides", catalogLinks: [] },
					},
					layoutItems: [
						{ type: "catalog", name: "api" },
						{ type: "section", id: "guides", title: "Guides", items: [] },
						{ type: "catalog", name: "onboarding" },
					],
				},
			},
		};

		expect(
			buildState(section).sections[0].items.map((item) => (item.type === "catalog" ? item.name : item.id)),
		).toEqual(["api", "guides", "onboarding"]);
	});

	test("falls back to folders then catalogs when a section has no layout items", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [],
			sections: {
				docs: {
					title: "Docs",
					href: "/docs",
					view: WorkspaceView.section,
					catalogLinks: [catalogLink("api", "API")],
					sections: {
						guides: { title: "Guides", href: "/docs/guides", catalogLinks: [] },
					},
				},
			},
		};

		expect(buildState(section).sections[0].items.map((item) => item.type)).toEqual(["folder", "catalog"]);
	});

	test("uses the root layout tree order for the uncategorized block", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [catalogLink("sandbox", "Sandbox"), catalogLink("playground", "Playground")],
			sections: {
				archive: { title: "Archive", href: "/archive", catalogLinks: [] },
			},
			layoutItems: [
				{ type: "catalog", name: "sandbox" },
				{ type: "section", id: "archive", title: "Archive", items: [] },
				{ type: "catalog", name: "playground" },
			],
		};

		const uncategorized = buildState(section).sections.find((s) => s.id === UNCATEGORIZED_ID);

		expect(uncategorized?.items.map((item) => (item.type === "catalog" ? item.name : item.id))).toEqual([
			"sandbox",
			"archive",
			"playground",
		]);
	});

	test("falls back to folders then catalogs when the root has no layout items", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [catalogLink("sandbox", "Sandbox")],
			sections: {
				archive: { title: "Archive", href: "/archive", catalogLinks: [] },
			},
		};

		const uncategorized = buildState(section).sections.find((s) => s.id === UNCATEGORIZED_ID);

		expect(uncategorized?.items.map((item) => item.type)).toEqual(["folder", "catalog"]);
	});

	test("builds homepage sections from catalog cards and folders", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [catalogLink("root-catalog", "Root catalog")],
			sections: {
				docs: {
					title: "Docs",
					href: "/docs",
					view: WorkspaceView.section,
					catalogLinks: [catalogLink("guide", "Guide")],
					sections: {
						nested: {
							title: "Nested",
							href: "/docs/nested",
							catalogLinks: [catalogLink("nested-guide", "Nested guide")],
						},
					},
				},
				tools: {
					title: "Tools",
					href: "/tools",
					catalogLinks: [catalogLink("cli", "CLI")],
				},
			},
		};

		expect(buildState(section).sections).toEqual([
			{
				id: "docs",
				title: "Docs",
				items: [
					{
						type: "folder",
						id: "nested",
						title: "Nested",
						items: ["nested-guide"],
						href: "/docs/nested",
					},
					{ type: "catalog", name: "guide" },
				],
			},
			{
				id: UNCATEGORIZED_ID,
				items: [
					{
						type: "folder",
						id: "tools",
						title: "Tools",
						items: ["cli"],
						href: "/tools",
					},
					{ type: "catalog", name: "root-catalog" },
				],
			},
		]);
	});
});

describe("folder open behavior", () => {
	test("folders navigate only outside edit mode", () => {
		const folder: HomeFolder = {
			type: "folder",
			id: "docs",
			title: "Docs",
			items: ["guide"],
			href: "/docs",
		};

		expect(canNavigateHomeFolder(folder, false)).toBe(true);
		expect(canNavigateHomeFolder(folder, true)).toBe(false);
	});
});
