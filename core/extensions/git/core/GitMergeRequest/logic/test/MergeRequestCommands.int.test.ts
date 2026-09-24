/**
 * @jest-environment node
 */

import { execSync } from "node:child_process";
import { OPEN_MERGE_REQUEST_PATH } from "@app/config/const";
import FileRepository from "@ext/git/core/Repository/test/utils/FileRepository";
import type WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import fs from "fs";

let rep: WorkdirRepository;
const fr = new FileRepository(__dirname);

const git = (command: string) => execSync(command, { cwd: fr.firstPath, stdio: "pipe" });

const createMergeRequest = () =>
	rep.mergeRequests.create(FileRepository.sourceData, {
		targetBranchRef: "master",
		title: "test title",
		description: "test description",
		approvers: [],
		createdAt: new Date(),
	});

/** the answer the removed full-workdir walk used to give */
const deletedByFullStatus = async () => {
	rep.gvc.resetCachedStatus();
	const status = await rep.gvc.getChanges("workdir");
	return status.some((s) => s.status === FileStatus.delete && s.path.compare(OPEN_MERGE_REQUEST_PATH));
};

/** the answer the pointwise question gives */
const deletedByFileStatus = async () => {
	rep.gvc.resetCachedStatus();
	const fileStatus = await rep.gvc.getFileStatus(OPEN_MERGE_REQUEST_PATH);
	return fileStatus?.status === FileStatus.delete;
};

const expectSameAnswer = async (expected: boolean) => {
	expect(await deletedByFullStatus()).toBe(expected);
	expect(await deletedByFileStatus()).toBe(expected);
};

describe("MergeRequestCommands спрашивает про файл merge request поточечно", () => {
	beforeEach(async () => {
		rep = fr.create().firstInstance;
		await rep.gvc.createNewBranch("feature");
	});

	afterEach(() => {
		fr.clear();
	});

	test("файла нет", async () => {
		expect(fs.existsSync(`${fr.firstPath}/${OPEN_MERGE_REQUEST_PATH.value}`)).toBeFalsy();

		await expectSameAnswer(false);
		rep.gvc.resetCachedStatus();
		expect(await rep.mergeRequests.tryGetDraft()).toBeUndefined();
	});

	test("файл есть", async () => {
		await createMergeRequest();
		git(`git commit -m "mr"`);

		await expectSameAnswer(false);
		rep.gvc.resetCachedStatus();
		expect((await rep.mergeRequests.tryGetDraft())?.title).toBe("test title");
	});

	test("файл удалён в индексе", async () => {
		await createMergeRequest();
		git(`git commit -m "mr"`);
		git(`git rm --cached ${OPEN_MERGE_REQUEST_PATH.value}`);

		await expectSameAnswer(false);
		rep.gvc.resetCachedStatus();
		expect(await rep.mergeRequests.tryGetDraft()).toBeUndefined();
	});

	test("файл удалён в рабочей копии", async () => {
		await createMergeRequest();
		git(`git commit -m "mr"`);
		fs.rmSync(`${fr.firstPath}/${OPEN_MERGE_REQUEST_PATH.value}`);

		await expectSameAnswer(true);
		rep.gvc.resetCachedStatus();
		expect(await rep.mergeRequests.tryGetDraft()).toBeUndefined();
	});
});
