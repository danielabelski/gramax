export const formatLicenseExpirationDate = (expirationDate: string, locale: string): string | null => {
	const date = new Date(expirationDate);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date);
};

export const isPerpetualLicense = (expirationDate: string): boolean =>
	new Date(expirationDate).getUTCFullYear() === 9999;

export const getLicenseLimit = ({
	editorCount,
	unlimitedEditors,
}: {
	editorCount?: number;
	unlimitedEditors?: boolean;
}): number | null | undefined => (unlimitedEditors ? null : editorCount);
