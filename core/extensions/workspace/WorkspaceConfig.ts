import type { ServicesConfig } from "@app/config/AppConfig";
import type { ModuleOptions } from "@ext/enterprise/types/UserSettings";
import type { AppSettings } from "@ext/settings/levels/app-settings";
import type { WorkspaceSettings } from "@ext/settings/levels/workspace-settings";
import type { StoredSettings } from "@ext/settings/logic/types";

export enum WorkspaceView {
	folder = "folder",
	section = "section",
}

export type WorkspaceSection = {
	title: string;
	icon?: string;
	view?: WorkspaceView;
	description?: string;
	catalogs?: string[];
	sections?: Record<string, WorkspaceSection>;
};

export type WorkspaceLayoutItem =
	| { type: "catalog"; name: string }
	| {
			type: "section";
			id: string;
			title: string;
			view?: WorkspaceView;
			icon?: string;
			description?: string;
			items: WorkspaceLayoutItem[];
	  };

export interface WorkspaceLayout {
	items: WorkspaceLayoutItem[];
	personal?: { items: WorkspaceLayoutItem[] };
}

export type WorkspaceSettingsSchema = StoredSettings<typeof WorkspaceSettings>;
export type WorkspaceAppSettingsSchema = StoredSettings<typeof AppSettings>;

/**
 * What a workspace states about LFS. `patterns` are the masks it owns and syncs into every catalog;
 * `auto` and `exclude` are the policy it imposes on the per-catalog auto-add — read through
 * `configLfsPolicy`, which also decides whether this workspace is entitled to impose one.
 */
export type WorkspaceLfsConfig = {
	patterns?: string[];
	auto?: boolean;
	exclude?: string[];
};

export interface WorkspaceConfig {
	name: string;
	id?: string;
	icon?: string | null;
	webEditorUrl?: string;
	layout?: WorkspaceLayout;
	/** @deprecated Use `layout.items`. */
	groups?: Record<string, WorkspaceSection>;
	/** @deprecated Use `layout.items`. */
	sections?: Record<string, WorkspaceSection>;
	/** @deprecated Use `layout.personal.items`. */
	personalSections?: Record<string, WorkspaceSection>;
	services?: ServicesConfig;
	enterprise?: {
		gesUrl?: string;
		lastUpdateDate?: number;
		refreshInterval?: number;
		modules?: ModuleOptions;
		lfs?: WorkspaceLfsConfig;
	};
	enterpriseCloud?: {
		url?: string;
	};
	git?: {
		lfs?: WorkspaceLfsConfig;
	};
	version?: number;
	settings?: WorkspaceSettingsSchema & WorkspaceAppSettingsSchema;
}

export type WorkspacePath = string;

export type ClientWorkspaceConfig = { path: WorkspacePath } & WorkspaceConfig;
