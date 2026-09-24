import type { ServicesConfig } from "@app/config/AppConfig";
import resolveWorkspaceServices from "./resolveWorkspaceServices";

const base: ServicesConfig = {
	gitProxy: { url: "https://app/git-proxy" },
	auth: { url: "https://app/auth" },
	diagramRenderer: { url: "https://app/diagram-renderer" },
	cloud: { url: null },
};

describe("resolveWorkspaceServices", () => {
	it("keeps app-level endpoints when the workspace has no services", () => {
		expect(resolveWorkspaceServices(base, undefined)).toEqual(base);
	});

	it("falls back per entry when the workspace services lack gitProxy", () => {
		const services = resolveWorkspaceServices(base, { auth: { url: "https://ges/auth" } });

		expect(services.gitProxy.url).toBe("https://app/git-proxy");
		expect(services.auth.url).toBe("https://ges/auth");
		expect(services.diagramRenderer.url).toBe("https://app/diagram-renderer");
	});

	it("takes every endpoint the workspace defines", () => {
		const workspaceServices: ServicesConfig = {
			gitProxy: { url: "https://ges/git-proxy" },
			auth: { url: "https://ges/auth" },
			diagramRenderer: { url: "https://ges/diagram-renderer" },
			cloud: { url: "https://ges/cloud" },
		};

		expect(resolveWorkspaceServices(base, workspaceServices)).toEqual(workspaceServices);
	});

	it("keeps an explicitly empty gitProxy empty instead of taking the app-level proxy", () => {
		const services = resolveWorkspaceServices(base, {
			gitProxy: { url: null },
			auth: { url: "https://ges/auth" },
			diagramRenderer: { url: "https://ges/diagram-renderer" },
		});

		expect(services.gitProxy.url).toBeNull();
		expect(services.auth.url).toBe("https://ges/auth");
	});

	it("falls back to the app-level endpoint when the entry states no url at all", () => {
		const services = resolveWorkspaceServices(base, { gitProxy: {} });

		expect(services.gitProxy.url).toBe("https://app/git-proxy");
	});
});
