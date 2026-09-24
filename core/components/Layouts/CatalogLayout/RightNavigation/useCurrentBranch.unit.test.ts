import ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import BranchUpdaterService, {
	type OnBranchUpdateErrorListener,
	type OnBranchUpdateListener,
} from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import { act, renderHook } from "@testing-library/react";
import { useCurrentBranch } from "./useCurrentBranch";

const branch = (name: string): GitBranchData => ({
	name,
	lastCommitModify: "",
	lastCommitAuthor: "",
	lastCommitAuthorMail: "",
	lastCommitOid: "",
});

describe("useCurrentBranch", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		BranchUpdaterService.reset();
	});

	it("returns the cached branch and follows branch updates", () => {
		let listener: OnBranchUpdateListener;
		let errorListener: OnBranchUpdateErrorListener;
		Reflect.set(BranchUpdaterService, "_branch", branch("main"));
		jest.spyOn(BranchUpdaterService, "addListener").mockImplementation((next) => {
			listener = next;
		});
		jest.spyOn(BranchUpdaterService, "addOnErrorListener").mockImplementation((next) => {
			errorListener = next;
		});
		const removeListener = jest.spyOn(BranchUpdaterService, "removeListener").mockImplementation();
		const removeErrorListener = jest.spyOn(BranchUpdaterService, "removeOnErrorListener").mockImplementation();

		const updateBranch = jest.spyOn(BranchUpdaterService, "updateBranch").mockResolvedValue();
		const apiUrlCreator = new ApiUrlCreator("", "catalog", "article.md");
		const { result, unmount } = renderHook(() => useCurrentBranch(true, apiUrlCreator));
		expect(result.current.branch?.name).toBe("main");
		expect(updateBranch).toHaveBeenCalledWith(apiUrlCreator, OnBranchUpdateCaller.Init);

		act(() => {
			void listener(branch("feature"), OnBranchUpdateCaller.Checkout);
		});
		expect(result.current.branch?.name).toBe("feature");

		act(() => {
			void errorListener(new Error("broken repository"));
		});
		expect(result.current.hasError).toBe(true);

		unmount();
		expect(removeListener).toHaveBeenCalledWith(listener);
		expect(removeErrorListener).toHaveBeenCalledWith(errorListener);
	});

	it("does not initialize the branch again when only the article changes", () => {
		jest.spyOn(BranchUpdaterService, "addListener").mockImplementation();
		jest.spyOn(BranchUpdaterService, "addOnErrorListener").mockImplementation();
		const updateBranch = jest.spyOn(BranchUpdaterService, "updateBranch").mockResolvedValue();
		const firstArticleApi = new ApiUrlCreator("", "catalog", "first.md");
		const secondArticleApi = new ApiUrlCreator("", "catalog", "second.md");
		const { rerender } = renderHook(({ apiUrlCreator }) => useCurrentBranch(true, apiUrlCreator), {
			initialProps: { apiUrlCreator: firstArticleApi },
		});

		rerender({ apiUrlCreator: secondArticleApi });

		expect(updateBranch).toHaveBeenCalledTimes(1);
	});
});
