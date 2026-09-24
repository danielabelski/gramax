import type { Router } from "@core/Api/Router";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import initEnterprise from "@ext/enterprise/utils/initEnterprise";
import { once, type UnlistenFn } from "@tauri-apps/api/event";
import { httpListenOnce } from "./commands";

const callbackName = "enterprise-login-done";
let currentUnlisten: UnlistenFn | null = null;

const enterpriseLogin = async (url: string, apiUrlCreator: ApiUrlCreator, router: Router) => {
	currentUnlisten?.();
	currentUnlisten = await once<string>(callbackName, (ev) => {
		currentUnlisten = null;
		const oneTimeCode = ev.payload?.replace?.("&from=http://localhost:52054", "")?.replace("oneTimeCode=", "");
		ModalToOpenService.resetValue();
		if (!oneTimeCode) return;

		void initEnterprise(
			router,
			apiUrlCreator.getAddEnterpriseWorkspaceUrl(oneTimeCode),
			apiUrlCreator.getCloneEnterpriseCatalogsUrl(),
		);
	});

	await httpListenOnce({ url, action: { type: "tryClose" }, callbackName });
};

export default enterpriseLogin;
