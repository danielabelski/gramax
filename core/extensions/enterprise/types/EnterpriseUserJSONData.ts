import type { PermissionMapType } from "@ext/security/logic/PermissionMap/IPermissionMap";
import type { BaseUserJSONData } from "@ext/security/logic/User/UserJSONData";

interface EnterpriseUserJSONData extends BaseUserJSONData {
	token: string;
	expiresAt?: number;
	catalogPermissionType: PermissionMapType;
	workspacePermissionType: PermissionMapType;
	workspacePermissionKeys: string[];
}

export default EnterpriseUserJSONData;
