import type GitSourceData from "@gramax/core/extensions/git/core/model/GitSourceData.schema";
import type GitSourceType from "@gramax/core/extensions/git/core/model/GitSourceType";
import { env } from "./utils";

export const getSourceDataFromEnv = (): GitSourceData => {
	return {
		sourceType: "GitLab" as GitSourceType,
		userEmail: env.optional("GX_E2E_GIT_EMAIL") || "e2e@gram.ax",
		userName: env.optional("GX_E2E_GIT_USERNAME") || "e2e",
		token: env("GX_E2E_GIT_TOKEN"),
		domain: env("GX_E2E_GIT_HOST"),
		protocol: "https",
		gitServerUsername: "git",
	};
};

export const getTestRepoInfoFromEnv = () => {
	return {
		testRepo: env("GX_E2E_GIT_TEST_REPO"),
		testRepoNoIndex: env("GX_E2E_GIT_TEST_REPO_NO_INDEX"),
		host: env("GX_E2E_GIT_HOST"),
		group: env("GX_E2E_GIT_GROUP"),
		tempGroup: env("GX_E2E_GIT_TEMP_GROUP"),
	} as const;
};
