/** biome-ignore-all lint/style/useNamingConvention: __esModule is the jest default-export mock convention */
import { renderHook } from "@testing-library/react";

jest.mock("@core/Api/useRouter", () => ({ useRouter: jest.fn() }));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	__esModule: true,
	default: { value: { conf: { isReadOnly: false } } },
}));
jest.mock("@core-ui/ContextServices/views/articleView/ArticleViewService", () => ({
	__esModule: true,
	default: { value: undefined },
}));
jest.mock("@core-ui/stores/DiffStore/DiffStore.provider", () => ({ useDiffStore: () => false }));
jest.mock("@ext/git/core/Diff/components/store/DiffViewModeStore", () => ({ useResourceDiffEnabled: () => false }));

import { useRouter } from "@core/Api/useRouter";
import { useIsDiffView } from "./useIsDiffView";

describe("useIsDiffView", () => {
	// docportal / SSR: resolveModule("Router") can yield null — the hook must not deref router blindly.
	it("does not throw when router is null", () => {
		(useRouter as jest.Mock).mockReturnValue(null);
		expect(() => renderHook(() => useIsDiffView())).not.toThrow();
	});

	it("returns false when nothing enables diff and router is present", () => {
		(useRouter as jest.Mock).mockReturnValue({ query: {} });
		const { result } = renderHook(() => useIsDiffView());
		expect(result.current).toBe(false);
	});
});
