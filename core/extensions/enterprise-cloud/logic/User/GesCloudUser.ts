import type { UserCatalogPropsSet } from "../../../enterpriseCommon/logic/user/UserCatalogProps";
import type IPermission from "../../../security/logic/Permission/IPermission";
import type IPermissionMap from "../../../security/logic/PermissionMap/IPermissionMap";
import User, { type UserType } from "../../../security/logic/User/User";
import type UserInfo from "../../../security/logic/User/UserInfo";

export class GesCloudUser extends User {
	private _catalogsProps: UserCatalogPropsSet;

	get type(): UserType {
		return "ges-cloud";
	}

	constructor(
		info: UserInfo,
		globalPermission: IPermission | null,
		workspacePermission: IPermissionMap,
		catalogPermission: IPermissionMap,
		catalogsProps: UserCatalogPropsSet,
	) {
		super(true, info, globalPermission, workspacePermission, catalogPermission);
		this._catalogsProps = catalogsProps;
	}

	updateCatalogSettings(newCatalogSettings: { permissions: IPermissionMap; props: UserCatalogPropsSet }) {
		this._catalogPermission = newCatalogSettings.permissions;
		this._catalogsProps = newCatalogSettings.props;
	}

	getCatalogSettings() {
		return { permissions: this._catalogPermission, props: this._catalogsProps };
	}
}
