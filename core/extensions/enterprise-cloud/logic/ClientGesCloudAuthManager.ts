import { getExecutingEnvironment } from "@app/resolveModule/env";
import { relocateToUrl } from "@ext/enterprise/components/SingInOut/hooks/useSignIn";
import { GesCloudApi, type GesCloudUserWithPermissions } from "@ext/enterprise-cloud/GesCloudApi";
import type { GesCloudManager } from "@ext/enterprise-cloud/GesCloudManager";
import AuthManager from "@ext/security/logic/AuthManager";
import localUser from "@ext/security/logic/User/localUser";
import type User from "@ext/security/logic/User/User";
import type { UserCatalogPropsSet } from "../../enterpriseCommon/logic/user/UserCatalogProps";
import type PermissionJSONData from "../../security/logic/Permission/model/PermissionJSONData";
import Permission from "../../security/logic/Permission/Permission";
import type IPermissionMap from "../../security/logic/PermissionMap/IPermissionMap";
import { PermissionMapType } from "../../security/logic/PermissionMap/IPermissionMap";
import parsePermissionMapFromJSON from "../../security/logic/PermissionMap/parsePermissionMapFromJSON";
import StrictPermissionMap from "../../security/logic/PermissionMap/StrictPermissionMap";
import { GesCloudUser } from "./User/GesCloudUser";

export class ClientGesCloudAuthManager extends AuthManager {
	private _cachedUser: GesCloudUser | User | null | undefined = undefined;

	constructor(
		private _enterpriseCloudManager: GesCloudManager,
		private _getWorkspacePath: () => string,
	) {
		super();
	}

	async login() {}
	async assert() {}
	async mailSendOTP() {}
	async mailLoginOTP() {}

	async logout() {
		this._cachedUser = undefined;
		if (getExecutingEnvironment() === "tauri") {
			const enterpriseCloudApi = new GesCloudApi((await this._enterpriseCloudManager.getConfig()).url);
			await enterpriseCloudApi.desktopLogout();
			await this._enterpriseCloudManager.setGesCloudUrl(undefined);
			await refreshPage();
		} else {
			const enterpriseCloudApi = new GesCloudApi((await this._enterpriseCloudManager.getConfig()).url);
			relocateToUrl(enterpriseCloudApi.getLogoutUrl());
		}
	}

	setUser(): void {
		this._cachedUser = undefined;
	}

	async getUser(): Promise<User> {
		if (this._cachedUser !== undefined) return Promise.resolve(this._cachedUser);

		let finalUser: User;

		const enterpriseCloudApi = new GesCloudApi((await this._enterpriseCloudManager.getConfig()).url);
		const userResponse = await enterpriseCloudApi.getUser();

		if (userResponse) {
			const { workspacePermissions, catalogsPermissions, catalogsProps } =
				this._createUserPermissions(userResponse);
			finalUser = new GesCloudUser(
				userResponse.info,
				null,
				workspacePermissions,
				catalogsPermissions,
				catalogsProps,
			);
		} else finalUser = localUser;

		this._cachedUser = finalUser;

		return this._cachedUser;
	}

	async updateUserPermissions() {
		const enterpriseCloudApi = new GesCloudApi((await this._enterpriseCloudManager.getConfig()).url);
		const userResponse = await enterpriseCloudApi.getUser();
		if (!userResponse) return;

		const { catalogsPermissions, catalogsProps } = this._createUserPermissions(userResponse);
		if (this._cachedUser instanceof GesCloudUser)
			this._cachedUser.updateCatalogSettings({ permissions: catalogsPermissions, props: catalogsProps });
	}

	private _createUserPermissions(userResponse: GesCloudUserWithPermissions): {
		workspacePermissions: StrictPermissionMap;
		catalogsPermissions: IPermissionMap;
		catalogsProps: UserCatalogPropsSet;
	} {
		const workspacePath = this._getWorkspacePath();
		const catalogsPermissions: { [catalogName: string]: PermissionJSONData } = {};
		for (const catalogName in userResponse.catalogsPermissions) {
			catalogsPermissions[catalogName] = new Permission(userResponse.catalogsPermissions[catalogName]).toJSON();
		}

		return {
			workspacePermissions: new StrictPermissionMap({
				[workspacePath]: new Permission(userResponse.workspacePermissions),
			}),
			catalogsPermissions: parsePermissionMapFromJSON({
				type: PermissionMapType.strict,
				permissions: catalogsPermissions,
			}),
			catalogsProps: userResponse.catalogsProps,
		};
	}
}
