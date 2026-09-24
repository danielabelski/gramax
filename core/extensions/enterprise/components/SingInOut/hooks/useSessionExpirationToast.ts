import t from "@ext/localization/locale/translate";
import { toast } from "@ui-kit/Toast";
import { useEffect } from "react";

const useSessionExpirationToast = (sessionExpired?: boolean) => {
	useEffect(() => {
		if (!sessionExpired) return;
		toast(t("enterprise-guest.session-expired"), {
			id: "enterprise-session-expired",
			status: "warning",
		});
	}, [sessionExpired]);
};

export default useSessionExpirationToast;
