import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import { pluginCommandExecutor } from "./pluginCommandExecutor";

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { fetch: jest.fn() },
}));

const fetchMock = FetchService.fetch as jest.Mock;

describe("pluginCommandExecutor", () => {
	afterEach(() => jest.clearAllMocks());

	test("executes commands through the environment fetcher", async () => {
		fetchMock.mockResolvedValue({ ok: true, json: async () => [{ path: "docs/index.md" }] });

		await expect(
			pluginCommandExecutor.execute("versionControl/statuses", { catalogName: "docs" }),
		).resolves.toEqual([{ path: "docs/index.md" }]);

		expect(fetchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				pathname: "/api/versionControl/statuses",
				query: { catalogName: "docs" },
			}),
			undefined,
			MimeTypes.json,
			Method.GET,
			false,
		);
	});
});
