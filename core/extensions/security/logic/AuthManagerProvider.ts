import type EnterpriseManager from "@ext/enterprise/EnterpriseManager";
import type { GesCloudManager } from "@ext/enterprise-cloud/GesCloudManager";
import ClientAuthManager from "@ext/security/logic/ClientAuthManager";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import EnterpriseClientAuthManager from "../../enterprise/EnterpriseClientAuthManager";
import { ClientGesCloudAuthManager } from "../../enterprise-cloud/logic/ClientGesCloudAuthManager";
import type AuthManager from "./AuthManager";

export interface AuthManagerProvider {
	current(): AuthManager;
}

export class ClientAuthManagerProvider implements AuthManagerProvider {
	private _gesCloudAuthManager: ClientGesCloudAuthManager;
	private _gesClientAuthManager: EnterpriseClientAuthManager;
	private _clientAuthManager: ClientAuthManager;

	constructor(
		private readonly _ecm: GesCloudManager,
		private readonly _em: EnterpriseManager,
		wm: WorkspaceManager,
	) {
		this._gesCloudAuthManager = new ClientGesCloudAuthManager(_ecm, () => wm.current()?.path() ?? "");
		this._gesClientAuthManager = new EnterpriseClientAuthManager(_em);
		this._clientAuthManager = new ClientAuthManager();
	}

	current(): AuthManager {
		if (this._ecm.isEnabled()) return this._gesCloudAuthManager;
		if (this._em.getConfig().gesUrl) return this._gesClientAuthManager;
		return this._clientAuthManager;
	}
}
