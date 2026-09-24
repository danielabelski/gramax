import { isManagedStorageSource } from "./isManagedStorageSource";

describe("isManagedStorageSource", () => {
	it.each([
		["GES", { enterprise: { gesUrl: "https://ges.example.com" } }],
		["Enterprise Cloud", { enterpriseCloud: { url: "https://ges.example.com" } }],
	])("определяет источник встроенного хранилища: %s", (_, config) => {
		expect(isManagedStorageSource(config, "ges.example.com")).toBe(true);
	});

	it("не принимает внешний источник в enterprise-workspace", () => {
		expect(
			isManagedStorageSource({ enterprise: { gesUrl: "https://ges.example.com" } }, "external.gitlab.example"),
		).toBe(false);
	});
});
