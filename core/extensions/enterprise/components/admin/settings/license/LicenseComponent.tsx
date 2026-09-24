import { useSettings } from "@ext/enterprise/components/admin/contexts/SettingsContext";
import { useAdminHeader } from "@ext/enterprise/components/admin/hooks/useAdminHeader";
import { StyledField } from "@ext/enterprise/components/admin/ui-kit/StyledField";
import { TabErrorBlock } from "@ext/enterprise/components/admin/ui-kit/TabErrorBlock";
import { TabInitialLoader } from "@ext/enterprise/components/admin/ui-kit/TabInitialLoader";
import type { LicenseInfo } from "@ext/enterprise/EnterpriseService";
import { toGesErrorCode } from "@ext/enterprise/errors/GesError";
import { Page } from "@ext/enterprise/types/Page";
import { getAdminPageTitle } from "@ext/enterprise/utils/getAdminPageTitle";
import t, { getCurrentLanguage } from "@ext/localization/locale/translate";
import { useCallback, useEffect, useState } from "react";
import { formatLicenseExpirationDate, getLicenseLimit, isPerpetualLicense } from "./licenseInfo";

const LicenseComponent = () => {
	const { getLicenseInfo } = useSettings();
	const [info, setInfo] = useState<LicenseInfo>();
	const [error, setError] = useState<unknown>();
	const [loading, setLoading] = useState(true);

	useAdminHeader({ title: getAdminPageTitle(Page.LICENSE) });

	const load = useCallback(async () => {
		setLoading(true);
		setError(undefined);
		try {
			setInfo(await getLicenseInfo());
		} catch (loadError) {
			setError(loadError);
		} finally {
			setLoading(false);
		}
	}, [getLicenseInfo]);

	useEffect(() => {
		void load();
	}, [load]);

	if (loading) return <TabInitialLoader />;
	if (error) return <TabErrorBlock code={toGesErrorCode(error)} onRetry={() => void load()} />;
	if (!info) return null;

	const limit = getLicenseLimit(info);
	const expirationDate = info.expirationDate
		? isPerpetualLicense(info.expirationDate)
			? t("enterprise.admin.license.perpetual")
			: formatLicenseExpirationDate(info.expirationDate, getCurrentLanguage())
		: null;
	const limitLabel =
		limit === null
			? t("enterprise.admin.license.unlimited")
			: (limit ?? t("enterprise.admin.license.not-specified"));

	return (
		<div className="space-y-4">
			<StyledField
				control={() => (
					<span>
						{info.isValid ? t("enterprise.admin.license.active") : t("enterprise.admin.license.invalid")}
					</span>
				)}
				title={t("enterprise.admin.license.status")}
			/>
			<StyledField
				control={() => <span>{expirationDate ?? t("enterprise.admin.license.not-specified")}</span>}
				title={t("enterprise.admin.license.expiration-date")}
			/>
			<StyledField control={() => <span>{limitLabel}</span>} title={t("enterprise.admin.license.editor-limit")} />
			<StyledField
				control={() => <span>{info.occupiedEditors}</span>}
				title={t("enterprise.admin.license.occupied-editors")}
			/>
		</div>
	);
};

export default LicenseComponent;
