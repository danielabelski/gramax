/** biome-ignore-all lint/style/useNamingConvention: __esModule is the jest default-export mock convention */
import { renderHook } from "@testing-library/react";

jest.mock("@core/Api/useRouter", () => ({ useRouter: jest.fn() }));

import { useRouter } from "@core/Api/useRouter";
import { useLeaveDiffView } from "./useLeaveDiffView";

describe("useLeaveDiffView", () => {
	it("drops the diff query so the article returns to the editor", () => {
		const pushQuery = jest.fn();
		(useRouter as jest.Mock).mockReturnValue({
			query: { diff: "1", oldScope: "HEAD", scope: "HEAD", mode: "wysiwyg" },
			pushQuery,
		});

		renderHook(() => useLeaveDiffView()).result.current();

		expect(pushQuery).toHaveBeenCalledWith({
			diff: undefined,
			oldScope: undefined,
			scope: undefined,
			mode: "wysiwyg",
		});
	});

	it("leaves the address alone when no diff is on screen", () => {
		const pushQuery = jest.fn();
		(useRouter as jest.Mock).mockReturnValue({ query: { mode: "wysiwyg" }, pushQuery });

		renderHook(() => useLeaveDiffView()).result.current();

		expect(pushQuery).not.toHaveBeenCalled();
	});
});
