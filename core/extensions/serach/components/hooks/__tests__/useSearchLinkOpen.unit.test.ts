import Url from "@core-ui/ApiServices/Types/Url";
import { type UseSearchLinkOpenArgs, useSearchLinkOpen } from "@ext/serach/components/hooks/useSearchLinkOpen";
import { renderHook } from "@testing-library/react";

const fragment = { text: "needle", indexInArticle: 2 };

const target = (pathname: string, withFragment = false) => ({
	url: Url.from({ pathname }),
	pathname,
	fragmentInfo: withFragment ? fragment : undefined,
});

const render = (overrides: Partial<UseSearchLinkOpenArgs> = {}) => {
	const close = jest.fn();
	const onLinkClick = jest.fn();
	const highlightFragment = jest.fn();
	const navigate = jest.fn();
	const result = renderHook(() =>
		useSearchLinkOpen({
			isHomePage: false,
			currentPathname: "docs/a",
			navigate,
			highlightFragment,
			close,
			onLinkClick,
			...overrides,
		}),
	);
	return { ...result, close, onLinkClick, highlightFragment, navigate };
};

describe("useSearchLinkOpen", () => {
	it("navigates, reports the click and closes the dialog for any link", () => {
		const { result, close, onLinkClick, navigate } = render();
		const opened = target("docs/b");

		result.current(opened);

		expect(navigate).toHaveBeenCalledWith(opened.url);
		expect(onLinkClick).toHaveBeenCalledWith("docs/b");
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("highlights the fragment when the link points at the open article", () => {
		const { result, highlightFragment } = render();

		result.current(target("docs/a", true));

		expect(highlightFragment).toHaveBeenCalledWith("needle", 2);
	});

	it("does not highlight a different article", () => {
		const { result, highlightFragment } = render();

		result.current(target("docs/b", true));

		expect(highlightFragment).not.toHaveBeenCalled();
	});

	it("does not highlight on the home page", () => {
		const { result, highlightFragment } = render({ isHomePage: true });

		result.current(target("docs/a", true));

		expect(highlightFragment).not.toHaveBeenCalled();
	});

	it("does not highlight without fragment info", () => {
		const { result, highlightFragment } = render();

		result.current(target("docs/a"));

		expect(highlightFragment).not.toHaveBeenCalled();
	});

	it("works on a platform with no highlighting", () => {
		const { result, close } = render({ highlightFragment: undefined });

		result.current(target("docs/a", true));

		expect(close).toHaveBeenCalledTimes(1);
	});
});
