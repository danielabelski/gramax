/**
 * @jest-environment node
 */
import EnterpriseApi from "./EnterpriseApi";

describe("EnterpriseApi.saveWorkspaceLayout", () => {
	afterEach(() => jest.restoreAllMocks());

	test("posts layout items to the authenticated GES workspace endpoint", async () => {
		const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
		const items = [{ type: "catalog" as const, name: "guide" }];

		await new EnterpriseApi("https://ges.example").saveWorkspaceLayout("token", items);

		expect(fetchMock).toHaveBeenCalledWith("https://ges.example/enterprise/config/workspace/layout/set", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
			body: JSON.stringify(items),
			credentials: "include",
		});
	});

	test("rejects when GES does not save the layout", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

		await expect(new EnterpriseApi("https://ges.example").saveWorkspaceLayout("token", [])).rejects.toThrow(
			"Failed to save workspace layout: 500",
		);
	});
});
