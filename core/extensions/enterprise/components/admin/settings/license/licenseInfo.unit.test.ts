import { formatLicenseExpirationDate, getLicenseLimit, isPerpetualLicense } from "./licenseInfo";

describe("license info presentation", () => {
	it("formats expiration date without a time component", () => {
		expect(formatLicenseExpirationDate("2027-08-31T00:00:00.000Z", "en-US")).toBe("August 31, 2027");
	});

	it("uses no numeric limit for an unlimited license", () => {
		expect(getLicenseLimit({ editorCount: 25, unlimitedEditors: true })).toBeNull();
	});

	it("uses editor count for a limited license", () => {
		expect(getLicenseLimit({ editorCount: 25, unlimitedEditors: false })).toBe(25);
	});

	it("keeps a missing editor limit distinct from zero", () => {
		expect(getLicenseLimit({ unlimitedEditors: false })).toBeUndefined();
	});

	it("returns no date for malformed expiration values", () => {
		expect(formatLicenseExpirationDate("not-a-date", "en-US")).toBeNull();
	});

	it("treats a license expiring in year 9999 as perpetual", () => {
		expect(isPerpetualLicense("9999-12-31T00:00:00.000Z")).toBe(true);
	});

	it("does not treat a regular expiration date as perpetual", () => {
		expect(isPerpetualLicense("2027-08-31T00:00:00.000Z")).toBe(false);
	});
});
