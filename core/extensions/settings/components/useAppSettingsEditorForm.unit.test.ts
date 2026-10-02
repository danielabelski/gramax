import { normalizeServices } from "./useAppSettingsEditorForm";

// GES states a service it deliberately doesn't use as `{ url: null }`
// (see app/utils/resolveWorkspaceServices.ts) — that sentinel reaches
// `appValues.services` unchanged and must render as a blank field.
describe("normalizeServices", () => {
	it("turns a null endpoint into an empty string", () => {
		expect(normalizeServices({ "git-proxy": { endpoint: null } })).toEqual({
			"git-proxy": { endpoint: "" },
		});
	});

	it("turns a missing endpoint into an empty string", () => {
		expect(normalizeServices({ "git-proxy": {} })).toEqual({
			"git-proxy": { endpoint: "" },
		});
	});

	it("leaves a real endpoint untouched", () => {
		expect(normalizeServices({ "git-proxy": { endpoint: "https://develop.gram.ax/git-proxy" } })).toEqual({
			"git-proxy": { endpoint: "https://develop.gram.ax/git-proxy" },
		});
	});

	it("normalizes every service independently", () => {
		expect(
			normalizeServices({
				"git-proxy": { endpoint: null },
				auth: { endpoint: "https://gram.ax/auth/" },
			}),
		).toEqual({
			"git-proxy": { endpoint: "" },
			auth: { endpoint: "https://gram.ax/auth/" },
		});
	});
});
