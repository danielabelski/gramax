import type { Section } from "@core/SitePresenter/SitePresenter";
import t from "@ext/localization/locale/translate";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as folderOps from "../utils/folderMutations";
import { buildState } from "../utils/homeLayoutBuilders";
import type { HomeLayoutEditScope, HomeSections, LayoutSnapshot } from "../utils/homeLayoutTypes";
import * as sectionOps from "../utils/sectionMutations";

const emptySnapshot: LayoutSnapshot = { sections: [] };

const UNDO_HISTORY_LIMIT = 50;

/**
 * Whether a mutation actually changed anything. Compares by content, not by reference, so a mutation is free to
 * rebuild the array it was given: a no-op still costs neither a state write nor an undo history entry. The reference
 * check is only the fast path for mutations that return their input untouched.
 */
const isSameSections = (a: HomeSections, b: HomeSections) => a === b || JSON.stringify(a) === JSON.stringify(b);

const isSameLayoutSnapshot = (a: LayoutSnapshot, b: LayoutSnapshot) => isSameSections(a.sections, b.sections);

const flattenCatalogNames = (sections: HomeSections) =>
	sections.flatMap((section) =>
		section.items.flatMap((item) => (item.type === "catalog" ? [item.name] : item.items)),
	);

const hasDuplicateCatalog = (sections: HomeSections) => {
	const names = flattenCatalogNames(sections);
	return new Set(names).size !== names.length;
};

const hasAnyCatalog = (sections: HomeSections) => flattenCatalogNames(sections).length > 0;

interface HomepageLayoutStore {
	views: Record<HomeLayoutEditScope, LayoutSnapshot>;
	activeView: HomeLayoutEditScope;
	editScope: HomeLayoutEditScope | null;
	editSnapshot: LayoutSnapshot | null;
	history: LayoutSnapshot[];
	future: LayoutSnapshot[];
	isMainPage: boolean;
	workspacePath?: string;
	hasPersonalOverride: boolean;
	/** Whether the workspace config lists some catalog under more than one section (gh#925), per view. */
	duplicateCatalogByScope: Record<HomeLayoutEditScope, boolean>;
	/** Whether the view has any catalogs to show/edit, per view. */
	hasCatalogsByScope: Record<HomeLayoutEditScope, boolean>;

	init(
		globalSection: Section,
		personalSection?: Section,
		hasPersonalOverride?: boolean,
		workspacePath?: string,
	): void;
	setActiveView(view: HomeLayoutEditScope): void;
	beginEdit(scope: HomeLayoutEditScope): void;
	commitEdit(): void;
	cancelEdit(): void;
	hasUnsavedChanges(): boolean;
	canUndo(): boolean;
	undo(): void;
	canRedo(): boolean;
	redo(): void;
	setIsMainPage(isMainPage: boolean): void;
	setSections(sections: HomeSections): void;
	addGroup(): void;
	setGroupTitle(key: string, title: string): void;
	deleteGroup(key: string): void;
	convertSectionToFolder(key: string): void;
	convertFolderToSection(folderId: string): void;
	deleteFolder(folderId: string): void;
	renameFolder(folderId: string, title: string): void;
	removeFromFolder(sectionId: string, folderId: string, catalogName: string): void;
	reorderFolderItems(sectionId: string, folderId: string, newOrder: string[]): void;
}

export const selectHomeSections = (state: HomepageLayoutStore) => state.views[state.activeView].sections;

export const useHomepageLayoutStore = create<HomepageLayoutStore>()(
	persist(
		(set, get) => {
			const setLayout = (updater: (sections: HomeSections) => HomeSections) => {
				set((state) => {
					const prevSnapshot = state.views[state.activeView];
					const nextSections = updater(prevSnapshot.sections);
					if (isSameSections(nextSections, prevSnapshot.sections)) return {};
					return {
						history: [...state.history, prevSnapshot].slice(-UNDO_HISTORY_LIMIT),
						future: [],
						views: { ...state.views, [state.activeView]: { sections: nextSections } },
					};
				});
			};

			return {
				views: { personal: emptySnapshot, global: emptySnapshot },
				activeView: "global",
				editScope: null,
				editSnapshot: null,
				history: [],
				future: [],
				isMainPage: true,
				workspacePath: undefined,
				hasPersonalOverride: false,
				duplicateCatalogByScope: { global: false, personal: false },
				hasCatalogsByScope: { global: false, personal: false },

				init(globalSection, personalSection = globalSection, hasPersonalOverride = false, workspacePath) {
					if (get().editScope !== null && get().workspacePath === workspacePath) return;
					const globalView = buildState(globalSection);
					const personalView = buildState(personalSection);
					set({
						views: { global: globalView, personal: personalView },
						editScope: null,
						editSnapshot: null,
						history: [],
						future: [],
						workspacePath,
						hasPersonalOverride,
						duplicateCatalogByScope: {
							global: hasDuplicateCatalog(globalView.sections),
							personal: hasDuplicateCatalog(personalView.sections),
						},
						hasCatalogsByScope: {
							global: hasAnyCatalog(globalView.sections),
							personal: hasAnyCatalog(personalView.sections),
						},
					});
				},

				setActiveView(view) {
					set((state) => (state.editScope !== null ? {} : { activeView: view }));
				},

				beginEdit(scope) {
					set((state) => {
						if (state.editScope !== null || state.duplicateCatalogByScope[scope]) return {};
						const view = state.views[scope];
						return {
							activeView: scope,
							editScope: scope,
							editSnapshot: view,
							history: [],
							future: [],
						};
					});
				},

				commitEdit() {
					set((state) => {
						const personalViewChanged =
							state.editScope === "personal" &&
							state.editSnapshot !== null &&
							!isSameLayoutSnapshot(state.views.personal, state.editSnapshot);
						const hasPersonalOverride = state.hasPersonalOverride || personalViewChanged;
						const views =
							state.editScope === "global" && !hasPersonalOverride
								? { ...state.views, personal: state.views.global }
								: state.views;
						return {
							editScope: null,
							editSnapshot: null,
							history: [],
							future: [],
							hasPersonalOverride,
							views,
						};
					});
				},

				cancelEdit() {
					set((state) => {
						if (!state.editSnapshot)
							return { editScope: null, editSnapshot: null, history: [], future: [] };
						return {
							editScope: null,
							editSnapshot: null,
							history: [],
							future: [],
							views: { ...state.views, [state.activeView]: state.editSnapshot },
						};
					});
				},

				hasUnsavedChanges() {
					const state = get();
					const { editSnapshot } = state;
					if (!editSnapshot) return false;
					return !isSameLayoutSnapshot(state.views[state.activeView], editSnapshot);
				},

				canUndo() {
					return get().history.length > 0;
				},

				undo() {
					set((state) => {
						if (state.history.length === 0) return {};
						const prevSnapshot = state.history[state.history.length - 1];
						const currentSnapshot = state.views[state.activeView];
						return {
							history: state.history.slice(0, -1),
							future: [...state.future, currentSnapshot].slice(-UNDO_HISTORY_LIMIT),
							views: {
								...state.views,
								[state.activeView]: { ...state.views[state.activeView], ...prevSnapshot },
							},
						};
					});
				},

				canRedo() {
					return get().future.length > 0;
				},

				redo() {
					set((state) => {
						if (state.future.length === 0) return {};
						const nextSnapshot = state.future[state.future.length - 1];
						const currentSnapshot = state.views[state.activeView];
						return {
							future: state.future.slice(0, -1),
							history: [...state.history, currentSnapshot].slice(-UNDO_HISTORY_LIMIT),
							views: {
								...state.views,
								[state.activeView]: { ...state.views[state.activeView], ...nextSnapshot },
							},
						};
					});
				},

				setIsMainPage(isMainPage) {
					set({ isMainPage });
				},

				setSections(sections) {
					setLayout(() => sections);
				},

				addGroup() {
					setLayout((sections) => sectionOps.addGroup(sections, t("new-section")));
				},

				setGroupTitle(key, title) {
					setLayout((sections) => sectionOps.setGroupTitle(sections, key, title));
				},

				deleteGroup(key) {
					setLayout((sections) => sectionOps.deleteGroup(sections, key));
				},

				convertSectionToFolder(key) {
					setLayout((sections) => sectionOps.convertSectionToFolder(sections, key));
				},

				convertFolderToSection(folderId) {
					setLayout((sections) => folderOps.convertFolderToSection(sections, folderId));
				},

				deleteFolder(folderId) {
					setLayout((sections) => folderOps.deleteFolder(sections, folderId));
				},

				renameFolder(folderId, title) {
					setLayout((sections) => folderOps.renameFolder(sections, folderId, title));
				},

				removeFromFolder(sectionId, folderId, catalogName) {
					setLayout((sections) => folderOps.removeFromFolder(sections, sectionId, folderId, catalogName));
				},

				reorderFolderItems(sectionId, folderId, newOrder) {
					setLayout((sections) => folderOps.reorderFolderItems(sections, sectionId, folderId, newOrder));
				},
			};
		},
		{
			name: "homepage-layout-active-view",
			partialize: (state) => ({ activeView: state.activeView }),
		},
	),
);
