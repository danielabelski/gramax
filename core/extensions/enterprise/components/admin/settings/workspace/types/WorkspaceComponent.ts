import type { WorkspaceLfsConfig } from "@ext/workspace/WorkspaceConfig";
import type { Access } from "../../components/roles/Access";

export type SVG = string;

export enum AuthMethod {
	SSO = "sso",
	GUEST_MAIL = "guest_mail",
}

export type AuthOption = {
	label: string;
	value: AuthMethod[];
};

export type WorkspaceSettings = {
	name: string;
	access?: Access;
	/**
	 * @deprecated Consider using `git.source` field. To be removed after jul-2026
	 */
	source?: {
		url: string;
		type: "GitLab";
		repos: string[] | null;
	};
	style?: {
		logo?: SVG;
		logoDark?: SVG;
		css?: string;
	};
	wordTemplates: ExportTemplate[];
	pdfTemplates: ExportTemplate[];
	modules?: {
		quiz?: boolean;
		guests?: boolean;
		metrics?: boolean;
	};
	git: {
		source: {
			url: string;
			type: "GitLab";
			repos: string[] | null;
		};
		lfs?: WorkspaceLfsConfig;
	};
};

export type ExportTemplate = {
	title: string;
	bufferBase64: string;
};
