import { getTokenIdentity } from "@utils/gitlab";

/**
 * Asks GitLab who the token is before a single test runs.
 *
 * Every git-backed spec fails in its own way when the token is not usable: a clone shows "Error
 * loading" and the catalog card never gets its title, a link reports a repository that is missing,
 * a teardown quietly leaves its repos behind. None of those name the cause, and finding it costs a
 * full run. One request does name it — a revoked token answers `401 invalid_token`, an expired one
 * the same, and a token with too small a role answers with an identity that cannot create projects.
 *
 * Only the identity is printed. The token never is.
 */
const globalSetup = async () => {
	if (!process.env.GX_E2E_GIT_TOKEN || !process.env.GX_E2E_GIT_HOST) return;

	let identity: Awaited<ReturnType<typeof getTokenIdentity>>;
	try {
		identity = await getTokenIdentity();
	} catch (e) {
		throw new Error(
			`GX_E2E_GIT_TOKEN is not usable against ${process.env.GX_E2E_GIT_HOST}: ${String(e)}\n\n` +
				`Every git-backed spec depends on it — cloning the fixture catalogs, and creating the ` +
				`temp repositories the push specs publish into. Replace the token before reading ` +
				`anything into the failures below.`,
		);
	}

	console.log(`e2e git token: ${identity.username}${identity.bot ? " (bot)" : ""}, state ${identity.state}`);
};

export default globalSetup;
