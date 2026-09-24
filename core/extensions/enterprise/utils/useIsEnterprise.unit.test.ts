/**
 * @jest-environment node
 */
import { useIsEnterprise } from "./useIsEnterprise";

const mockPageDataContext = {
	conf: {
		activeGesUrl: undefined as string | undefined,
		enterprise: { gesUrl: undefined as string | undefined },
	},
};

jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	get value() {
		return mockPageDataContext;
	},
}));

describe("useIsEnterprise", () => {
	beforeEach(() => {
		mockPageDataContext.conf.activeGesUrl = undefined;
		mockPageDataContext.conf.enterprise.gesUrl = undefined;
	});

	test("detects GES web by its active endpoint", () => {
		mockPageDataContext.conf.activeGesUrl = "https://ges.example";
		mockPageDataContext.conf.enterprise.gesUrl = "https://ges.example";

		expect(useIsEnterprise()).toBe(true);
	});

	test("detects a desktop workspace linked to GES", () => {
		mockPageDataContext.conf.enterprise.gesUrl = "https://ges.example";

		expect(useIsEnterprise()).toBe(true);
	});

	test("returns false outside GES", () => {
		expect(useIsEnterprise()).toBe(false);
	});

	test("does not treat a local workspace as GES after another workspace logged in", () => {
		mockPageDataContext.conf.activeGesUrl = "https://ges.example";

		expect(useIsEnterprise()).toBe(false);
	});
});
