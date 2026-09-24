import type { ContentLanguage } from "@ext/localization/core/model/Language";
import type { Property } from "@ext/properties/models";
import type { CatalogSearchScope } from "@ext/serach/components/model/searchScope";
import type { ResourceFilter } from "@ext/serach/Searcher";
import { useState } from "react";
import { createFakeGateway, type FakeGateway } from "../model/__tests__/fixtures";

/**
 * The environment `useSearchState` reads from its contexts. Tests mutate it before
 * rendering; the jest.mock factories in the test file read it on every render.
 */
export interface SearchEnv {
	gateway: FakeGateway;
	platform: "next" | "static" | "web" | "tauri";
	catalogName?: string;
	catalogDefaultLanguage?: ContentLanguage;
	currentArticleLanguage?: ContentLanguage;
	currentPathname?: string;
	currentArticleRefPath?: string;
	properties: Map<string, Property>;
	aiEnabled: boolean;
	isReadOnly: boolean;
	resourcesEnabled: boolean;
	openRequest: { has: boolean; scope?: CatalogSearchScope };
	navigate: jest.Mock;
	notifyError: jest.Mock;
	emitPluginEvent: jest.Mock;
	highlightInEditor: jest.Mock;
	highlightInDocportal: jest.Mock;
}

export let env: SearchEnv;

export const resetSearchEnv = (overrides: Partial<SearchEnv> = {}) => {
	env = {
		gateway: createFakeGateway(),
		platform: "next",
		catalogName: "docs",
		properties: new Map(),
		aiEnabled: false,
		isReadOnly: false,
		resourcesEnabled: false,
		openRequest: { has: false },
		navigate: jest.fn(),
		notifyError: jest.fn(),
		emitPluginEvent: jest.fn(),
		highlightInEditor: jest.fn(),
		highlightInDocportal: jest.fn(),
		...overrides,
	};

	return env;
};

/** Stand-in for the SearchQuery context service, which owns query + resource filter state. */
export const useSearchQueryContext = () => {
	const [query, setQuery] = useState("");
	const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("with");

	return {
		query,
		setQuery,
		resourceFilter,
		setResourceFilter,
		hasOpenRequest: env.openRequest.has,
		requestedScopeFilter: env.openRequest.scope,
		requestOpen: jest.fn(),
		clearOpenRequest: () => {
			env.openRequest = { has: false };
		},
	};
};

export const platformFlags = () => ({
	isWeb: env.platform === "web",
	isTauri: env.platform === "tauri",
	isNext: env.platform === "next",
	isStatic: env.platform === "static",
	isDocportal: false,
	isStaticCli: false,
	environment: env.platform,
});

export const pageDataContext = () => ({
	language: { content: env.currentArticleLanguage },
	conf: {
		isReadOnly: env.isReadOnly,
		ai: { enabled: env.aiEnabled },
		search: { resourcesEnabled: env.resourcesEnabled },
	},
});
