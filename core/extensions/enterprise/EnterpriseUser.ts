import type { EnterpriseConfig } from "@app/config/AppConfig";
import EnterpriseApi from "@ext/enterprise/EnterpriseApi";
import { GesError } from "@ext/enterprise/errors/GesError";
import type EnterpriseUserJSONData from "@ext/enterprise/types/EnterpriseUserJSONData";
import type IPermission from "@ext/security/logic/Permission/IPermission";
import parsePermissionFromJSON from "@ext/security/logic/Permission/logic/PermissionParser";
import type PermissionJSONData from "@ext/security/logic/Permission/model/PermissionJSONData";
import PermissionType from "@ext/security/logic/Permission/model/PermissionType";
import Permission from "@ext/security/logic/Permission/Permission";
import type IPermissionMap from "@ext/security/logic/PermissionMap/IPermissionMap";
import { PermissionMapType } from "@ext/security/logic/PermissionMap/IPermissionMap";
import parsePermissionMapFromJSON from "@ext/security/logic/PermissionMap/parsePermissionMapFromJSON";
import User, { type UserType } from "@ext/security/logic/User/User";
import type UserInfo from "@ext/security/logic/User/UserInfo";
import type { UserCatalogPropsSet } from "../enterpriseCommon/logic/user/UserCatalogProps";

export interface EnterpriseInfo {
	workspacePermission: IPermissionMap;
	catalogPermission: IPermissionMap;
	updateDate: Date;
	catalogsProps: UserCatalogPropsSet;
}

interface UpdatePermissionsOptions {
	throwOnUnauthorized?: boolean;
}

class EnterpriseUser extends User {
	private _updateInterval = 1000 * 60 * 10; // 10 minutes
	private _enterpriseInfo: EnterpriseInfo;
	private _sessionExpired = false;

	constructor(
		isLogged = false,
		info?: UserInfo,
		globalPermission?: IPermission,
		workspacePermission?: IPermissionMap,
		catalogPermission?: IPermissionMap,
		private _enterpriseConfig?: EnterpriseConfig,
		private _token?: string,
		private _expiresAt?: number,
	) {
		super(isLogged, info, globalPermission, workspacePermission, catalogPermission);
		this._enterpriseInfo = {
			workspacePermission: this._workspacePermission,
			catalogPermission: this._catalogPermission,
			updateDate: new Date(0),
			catalogsProps: {},
		};
	}

	get type(): UserType {
		return "enterprise";
	}

	get token(): string {
		return this._token;
	}

	get expiresAt(): number | undefined {
		return this._expiresAt;
	}

	get sessionExpired(): boolean {
		return this._sessionExpired;
	}

	markSessionExpired(): void {
		this._sessionExpired = true;
	}

	setEnterpriseInfo(info: EnterpriseInfo): void {
		if (!info) return;
		this._enterpriseInfo = info;
		this._catalogPermission = info.catalogPermission;
		this._workspacePermission = info.workspacePermission;
	}

	getEnterpriseInfo(): EnterpriseInfo {
		return this._enterpriseInfo;
	}

	async updatePermissions(force = false, options: UpdatePermissionsOptions = {}): Promise<EnterpriseUser> {
		// if (!this._token) return; -- not needed because we get user data from null token (anonymous user)
		if (!this._enterpriseConfig?.gesUrl) return;

		const timeDiff = Date.now() - this._enterpriseInfo.updateDate.getTime();
		const interval = this._enterpriseConfig?.refreshInterval ?? this._updateInterval;
		if (this._enterpriseInfo && timeDiff < interval && !force) {
			return;
		}

		try {
			const data = await new EnterpriseApi(this._enterpriseConfig?.gesUrl).getUser(this._token);
			if (!data) {
				console.log(`User data not found. ${this._enterpriseConfig?.gesUrl}`);
				return null;
			}

			const catalogsPermissions: { [catalogName: string]: PermissionJSONData } = {};
			for (const catalogName in data.catalogsPermissions) {
				catalogsPermissions[catalogName] = new Permission(data.catalogsPermissions[catalogName]).toJSON();
			}

			this._info = data.info;
			this._expiresAt = data.expiresAt;
			this._workspacePermission.updateAllPermissions(new Permission(data.workspacePermissions));

			this._enterpriseInfo = {
				workspacePermission: this._workspacePermission,
				catalogPermission: parsePermissionMapFromJSON({
					type: this._catalogPermission.type,
					permissions: catalogsPermissions,
				}),
				catalogsProps: data.catalogsProps,
				updateDate: new Date(),
			};
			this._catalogPermission = this._enterpriseInfo.catalogPermission;

			return this;
		} catch (error) {
			if (options.throwOnUnauthorized && error instanceof GesError && error.code === "unauthorized") throw error;
			console.warn("Failed to update enterprise permissions, using cached", error);
			return this;
		}
	}

	getToken(): string {
		return this._token;
	}

	override toJSON(): EnterpriseUserJSONData {
		return {
			info: this._info,
			type: this.type,
			isLogged: this.isLogged,
			globalPermission: this._globalPermission?.toJSON?.(),
			catalogPermissionType: this._catalogPermission.type,
			workspacePermissionType: this._workspacePermission.type,
			workspacePermissionKeys: this._workspacePermission.keys,
			token: this._token ?? "",
			expiresAt: this._expiresAt,
		};
	}

	static override initInJSON(json: EnterpriseUserJSONData, enterpriseConfig?: EnterpriseConfig): EnterpriseUser {
		const permissions = {};
		for (const key of json.workspacePermissionKeys ?? []) {
			permissions[key] = { permissions: [], type: PermissionType.plain };
		}

		const user = new EnterpriseUser(
			json.isLogged,
			json.info,
			parsePermissionFromJSON(json.globalPermission),
			parsePermissionMapFromJSON({
				type: json.workspacePermissionType ?? PermissionMapType.strict,
				permissions,
			}),
			parsePermissionMapFromJSON({
				type: json.catalogPermissionType ?? PermissionMapType.strict,
				permissions: {},
			}),
			enterpriseConfig,
			json.token,
			json.expiresAt,
		);
		return user;
	}
}

export default EnterpriseUser;
