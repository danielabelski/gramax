import { updateGesCloudUrl } from "./GesCloudUrlUtils";

describe("updateGesCloudUrl", () => {
	it.each([
		["https://app.gram.ax", "https://app.gram.ax"],
		["https://app.gram.ax", "https://abc12.app.gram.ax"],
		["https://dev-cloud.gram.ax", "https://dev-cloud.gram.ax"],
		["https://dev-cloud.gram.ax", "https://abc12.dev-cloud.gram.ax"],
		["https://app.gram.ax/", "https://abc12.app.gram.ax"],
		["https://app.gram.ax", "https://abc12.app.gram.ax/"],
	])("does not update when base URL %s already matches current URL %s", (newBaseUrl, currentGesCloudUrl) => {
		expect(updateGesCloudUrl(newBaseUrl, currentGesCloudUrl)).toEqual({ updated: false });
	});

	it.each([
		["https://app.gram.ax", "https://abc12.dev-cloud.gram.ax", "https://abc12.app.gram.ax"],
		["https://dev-cloud.gram.ax", "https://abc12.app.gram.ax", "https://abc12.dev-cloud.gram.ax"],
		["https://app.gram.ax/", "https://abc12.dev-cloud.gram.ax/", "https://abc12.app.gram.ax"],
		["https://app.gram.ax", "https://xyz34.dev-cloud.gram.ax", "https://xyz34.app.gram.ax"],
	])("preserves the organization ID when switching to %s from %s", (newBaseUrl, currentGesCloudUrl, expectedUrl) => {
		expect(updateGesCloudUrl(newBaseUrl, currentGesCloudUrl)).toEqual({
			updated: true,
			newGesCloudUrl: expectedUrl,
		});
	});

	it("preserves the organization ID while using the new base path and query parameters", () => {
		expect(
			updateGesCloudUrl(
				"https://app.gram.ax/enterprise-cloud?region=eu&lang=ru",
				"https://abc12.dev-cloud.gram.ax/old-api?debug=true",
			),
		).toEqual({
			updated: true,
			newGesCloudUrl: "https://abc12.app.gram.ax/enterprise-cloud?region=eu&lang=ru",
		});
	});

	it.each(["", "app.gram.ax", "/enterprise-cloud", "https://"])(
		"does not update when the new base URL is invalid: %j",
		(newBaseUrl) => {
			expect(updateGesCloudUrl(newBaseUrl, "https://abc12.dev-cloud.gram.ax")).toEqual({ updated: false });
		},
	);

	it.each(["", "abc12.dev-cloud.gram.ax", "/enterprise-cloud", "https://"])(
		"does not update when the current URL is invalid: %j",
		(currentGesCloudUrl) => {
			expect(updateGesCloudUrl("https://app.gram.ax", currentGesCloudUrl)).toEqual({ updated: false });
		},
	);
});
