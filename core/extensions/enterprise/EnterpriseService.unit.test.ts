import EnterpriseService from "./EnterpriseService";

describe("EnterpriseService license info", () => {
	it("returns license information from GES", async () => {
		const response = {
			isValid: true,
			editorCount: 25,
			expirationDate: "2027-08-31T00:00:00.000Z",
			unlimitedEditors: false,
			occupiedEditors: 2,
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => response,
		}) as never;

		const result = await new EnterpriseService("https://ges.example.com").getLicenseInfo("token");

		expect(result).toEqual(response);
	});
});
