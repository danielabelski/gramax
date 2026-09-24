function createGesCloudUrlByOrg(organizationId: string, baseUrl: string): string {
	const originalUrl = new URL(baseUrl);
	const newUrl = new URL(`${originalUrl.protocol}//${organizationId}.${originalUrl.host}${originalUrl.pathname}`);

	for (const [key, value] of originalUrl.searchParams) {
		newUrl.searchParams.set(key, value);
	}
	const stringifiedUrl = newUrl.toString();
	return stringifiedUrl.endsWith("/") ? stringifiedUrl.slice(0, -1) : stringifiedUrl;
}

export function updateGesCloudUrl(
	newBaseUrl: string,
	currentGesCloudUrl: string,
): { updated: false } | { updated: true; newGesCloudUrl: string } {
	try {
		const baseHost = new URL(newBaseUrl).hostname;
		const currentHost = new URL(currentGesCloudUrl).hostname;

		if (currentHost === baseHost) return { updated: false };

		if (currentHost.split(".").length !== baseHost.split(".").length + 1)
			return { updated: true, newGesCloudUrl: newBaseUrl };

		if (currentHost.endsWith(`.${baseHost}`)) return { updated: false };

		return { updated: true, newGesCloudUrl: createGesCloudUrlByOrg(currentHost.split(".")[0], newBaseUrl) };
	} catch {
		return { updated: false };
	}
}
