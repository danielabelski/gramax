import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import EnterpriseClientAuthManager from "@ext/enterprise/EnterpriseClientAuthManager";
import EnterpriseUser from "@ext/enterprise/EnterpriseUser";

const refreshEnterprisePermissions = async (
	app: Application,
	ctx: Context,
	gesUrl?: string,
): Promise<boolean | undefined> => {
	const am = app.amp.current();
	const isEnterprise = gesUrl && am instanceof EnterpriseClientAuthManager && ctx.user instanceof EnterpriseUser;
	if (!isEnterprise) return;

	const permissionUpdateDate = ctx.user.getEnterpriseInfo()?.updateDate?.getTime();
	await am.forceUpdateEnterpriseUser(ctx.cookie, ctx.user);

	return permissionUpdateDate !== ctx.user.getEnterpriseInfo()?.updateDate?.getTime();
};

export default refreshEnterprisePermissions;
