import { execSync } from "node:child_process";
import Path from "@core/FileProvider/Path/Path";
import MergeConflictCaller from "@ext/git/actions/MergeConflictHandler/model/MergeConflictCaller";
import FileRepository from "@ext/git/core/Repository/test/utils/FileRepository";
import type WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import fs from "fs";

const fr = new FileRepository(__dirname);

describe("FileRepository", () => {
	it("should create a file repositories", async () => {
		const { firstInstance, secondInstance } = fr.create();

		expect(fs.existsSync(fr.firstPath)).toBeTruthy();
		expect(fs.existsSync(fr.secondPath)).toBeTruthy();
		expect(fs.existsSync(fr.barePath)).toBeTruthy();

		expect(fs.readFileSync(`${fr.firstPath}/init`, "utf-8")).toBe("init");
		expect(fs.readFileSync(`${fr.secondPath}/init`, "utf-8")).toBe("init");

		const firstCurrentBranchData = (await firstInstance.gvc.getCurrentBranch()).getData();
		const secondCurrentBranchData = (await secondInstance.gvc.getCurrentBranch()).getData();

		expect(firstCurrentBranchData.lastCommitAuthor).toBe(FileRepository.sourceData.userName);
		expect(firstCurrentBranchData.name).toBe("master");

		expect(secondCurrentBranchData.lastCommitAuthor).toBe(FileRepository.sourceData.userName);
		expect(secondCurrentBranchData.name).toBe("master");
	});

	it("should clear the file repositories", () => {
		fr.clear();

		expect(fs.existsSync(fr.barePath)).toBeFalsy();
		expect(fs.existsSync(fr.firstPath)).toBeFalsy();
		expect(fs.existsSync(fr.secondPath)).toBeFalsy();
	});

	describe("works with git commands", () => {
		let testRepository: FileRepository;
		let testDirectory: string;
		let firstInstance: WorkdirRepository;
		let secondInstance: WorkdirRepository;

		const remoteHead = () => execSync("git rev-parse master", { cwd: testRepository.barePath }).toString().trim();

		beforeEach(() => {
			testDirectory = fs.mkdtempSync(`${__dirname}/file-repository-`);
			testRepository = new FileRepository(testDirectory);
			({ firstInstance, secondInstance } = testRepository.create());
		});

		afterEach(() => {
			testRepository.clear();
			fs.rmSync(testDirectory, { recursive: true });
		});

		test("pull and push", async () => {
			fs.writeFileSync(`${testRepository.firstPath}/test.txt`, "test");

			await firstInstance.publish({
				data: FileRepository.sourceData,
				commitMessage: "test",
				filesToPublish: [new Path("test.txt")],
			});

			await secondInstance.sync({ data: FileRepository.sourceData });
			expect(fs.readFileSync(`${testRepository.secondPath}/test.txt`, "utf-8")).toBe("test");
		});

		test("identifies a pull started by checkout as a branch operation", async () => {
			const pull = jest.spyOn(
				secondInstance as unknown as Record<
					"_pull",
					(opts: { caller: MergeConflictCaller }) => Promise<unknown>
				>,
				"_pull",
			);

			await secondInstance.checkout({ data: FileRepository.sourceData, branch: "master" });

			expect(pull).toHaveBeenCalledWith(expect.objectContaining({ caller: MergeConflictCaller.Branch }));
		});

		test("sync stops on a conflicting pull instead of pushing over it", async () => {
			fs.writeFileSync(`${testRepository.firstPath}/init`, "theirs");
			await firstInstance.publish({
				data: FileRepository.sourceData,
				commitMessage: "theirs",
				filesToPublish: [new Path("init")],
			});

			const headBeforeSync = remoteHead();

			fs.writeFileSync(`${testRepository.secondPath}/init`, "ours");
			await secondInstance.gvc.add();
			await secondInstance.gvc.commit("ours", FileRepository.sourceData);

			const { mergeData } = await secondInstance.sync({ data: FileRepository.sourceData });

			expect(mergeData.map((file) => file.path)).toEqual(["init"]);
			expect(fs.readFileSync(`${testRepository.secondPath}/init`, "utf-8")).toContain("<<<<<<<");

			const state = (await secondInstance.getState()).inner;
			expect(state.value).toBe("mergeConflict");
			expect(remoteHead()).toBe(headBeforeSync);
			await (await secondInstance.getState()).abortMerge(FileRepository.sourceData);
		});

		test.each([
			[
				"resolve",
				async (repository: WorkdirRepository) => {
					const state = await repository.getState();
					await state.resolveMerge([{ path: "init", content: "resolved" }], FileRepository.sourceData);
				},
			],
			[
				"abort",
				async (repository: WorkdirRepository) => {
					const state = await repository.getState();
					await state.abortMerge(FileRepository.sourceData);
				},
			],
		])("restores dirty work after users %s a pull conflict", async (_action, finishConflict) => {
			fs.writeFileSync(`${testRepository.firstPath}/init`, "theirs");
			await firstInstance.publish({
				data: FileRepository.sourceData,
				commitMessage: "theirs",
				filesToPublish: [new Path("init")],
			});

			fs.writeFileSync(`${testRepository.secondPath}/init`, "ours");
			await secondInstance.gvc.add();
			await secondInstance.gvc.commit("ours", FileRepository.sourceData);
			fs.writeFileSync(`${testRepository.secondPath}/draft.md`, "local draft");

			await secondInstance.sync({ data: FileRepository.sourceData });
			expect(fs.existsSync(`${testRepository.secondPath}/draft.md`)).toBeFalsy();

			await finishConflict(secondInstance);

			expect(fs.readFileSync(`${testRepository.secondPath}/draft.md`, "utf-8")).toBe("local draft");
		});

		test("restores dirty work when a pull conflict becomes invalid", async () => {
			fs.writeFileSync(`${testRepository.firstPath}/init`, "theirs");
			await firstInstance.publish({
				data: FileRepository.sourceData,
				commitMessage: "theirs",
				filesToPublish: [new Path("init")],
			});

			fs.writeFileSync(`${testRepository.secondPath}/init`, "ours");
			await secondInstance.gvc.add();
			await secondInstance.gvc.commit("ours", FileRepository.sourceData);
			fs.writeFileSync(`${testRepository.secondPath}/draft.md`, "local draft");
			await secondInstance.sync({ data: FileRepository.sourceData });

			fs.writeFileSync(`${testRepository.secondPath}/init`, "resolved manually");
			await secondInstance.gvc.add(null, true);
			const state = await secondInstance.getState();

			expect(await state.isMergeStateValid()).toBeFalsy();
			expect(fs.readFileSync(`${testRepository.secondPath}/draft.md`, "utf-8")).toBe("local draft");
		});

		test("keeps a resolved pull merge when restoring dirty work fails", async () => {
			fs.writeFileSync(`${testRepository.firstPath}/init`, "theirs");
			await firstInstance.publish({
				data: FileRepository.sourceData,
				commitMessage: "theirs",
				filesToPublish: [new Path("init")],
			});

			fs.writeFileSync(`${testRepository.secondPath}/init`, "ours");
			await secondInstance.gvc.add();
			await secondInstance.gvc.commit("ours", FileRepository.sourceData);
			fs.writeFileSync(`${testRepository.secondPath}/draft.md`, "local draft");
			await secondInstance.sync({ data: FileRepository.sourceData });

			jest.spyOn(secondInstance.gvc, "applyStash").mockRejectedValueOnce(new Error("stash blocked"));
			const headBeforeResolve = remoteHead();
			const state = await secondInstance.getState();

			await expect(
				state.resolveMerge([{ path: "init", content: "resolved" }], FileRepository.sourceData),
			).resolves.toBeUndefined();
			expect(remoteHead()).not.toBe(headBeforeResolve);
			expect(state.inner.value).toBe("default");
		});
	});
});
