import type { ServicesConfig } from "@app/config/AppConfig";

/** A service entry as a workspace states it — GES writes `{ url: null }` for a service it does not use. */
type StatedService = { url?: string | null };

type WorkspaceServices = { [K in keyof ServicesConfig]?: StatedService | null };

/** The workspace names the service and gives it no address: it is deliberately empty, not absent. */
export const statesEmptyService = (stated: StatedService | null | undefined): boolean =>
	!!stated && stated.url !== undefined && !stated.url;

/**
 * A service the workspace does not state falls back to the app-level endpoint; a deliberately
 * empty one does not, or the app-level address would take the place GES left empty on purpose.
 */
const resolveServiceUrl = (stated: StatedService | null | undefined, appLevelUrl: string): string =>
	statesEmptyService(stated) ? null : (stated?.url ?? appLevelUrl);

const resolveWorkspaceServices = (
	base: ServicesConfig,
	workspaceServices?: WorkspaceServices | null,
): ServicesConfig => ({
	...base,
	gitProxy: { url: resolveServiceUrl(workspaceServices?.gitProxy, base.gitProxy.url) },
	auth: { url: resolveServiceUrl(workspaceServices?.auth, base.auth.url) },
	diagramRenderer: { url: resolveServiceUrl(workspaceServices?.diagramRenderer, base.diagramRenderer.url) },
	cloud: { url: resolveServiceUrl(workspaceServices?.cloud, base.cloud?.url) },
});

export default resolveWorkspaceServices;
