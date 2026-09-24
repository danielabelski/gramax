import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const mockFetch = jest.fn();

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

const mockNotify = jest.fn();
jest.mock("@ext/errorHandlers/client/ErrorConfirmService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { notify: (...args: unknown[]) => mockNotify(...args) },
}));

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

let lastClick: void | Promise<void>;

// The dialog is a set of slots handed to the shared ui-kit template; the template itself is covered
// by the e2e cases, so here it is flattened into the pieces the assertions below reach for.
jest.mock("@ui-kit/AlertDialog", () => {
	const react = require("react");
	type Slots = {
		title?: ReactNode;
		description?: ReactNode;
		details?: ReactNode;
		note?: ReactNode;
		cancelText?: string;
		confirmText?: string;
		running?: boolean;
		onCancel?: () => void;
		onConfirm?: () => void | Promise<void>;
	};
	const button = (text: ReactNode, running: boolean, handler?: () => void | Promise<void>) =>
		react.createElement(
			"button",
			{ disabled: running, onClick: handler ? () => (lastClick = handler()) : undefined },
			text,
		);

	return {
		AlertProgressConfirm: (props: Slots) =>
			react.createElement(
				"div",
				null,
				props.title,
				props.description,
				props.details,
				props.note,
				button(props.cancelText, !!props.running, props.onCancel),
				button(props.confirmText, !!props.running, props.onConfirm),
			),
	};
});

import LfsAutoAttachmentsDialog from "./LfsAutoAttachmentsDialog";

const apiUrlCreator = {
	enableAutoLfsAttachments: () => "enable-url",
	getAttachmentsMigrationStats: () => "stats-url",
} as unknown as ApiUrlCreator;

const stats = {
	fileCount: 2,
	totalSize: 2048,
	added: ["*.png"],
	fileDiff: { before: "", after: "*.png filter=lfs\n" },
};

const renderDialog = (onSettled: () => void) =>
	render(createElement(LfsAutoAttachmentsDialog, { apiUrlCreator, exclude: [], stats, onSettled }));

const clickMigrate = () => fireEvent.click(screen.getByText("git.lfs-auto-attachments.alert.migrate"));

describe("LfsAutoAttachmentsDialog stats", () => {
	beforeEach(() => {
		mockFetch.mockReset();
		mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
	});

	it("shows the .gitattributes diff it was handed", async () => {
		renderDialog(jest.fn());

		await waitFor(() => expect(screen.getByText(/\*\.png filter=lfs/)).toBeTruthy());
	});

	it("never fetches the stats itself", async () => {
		renderDialog(jest.fn());

		await waitFor(() => expect(screen.getByText("git.lfs-auto-attachments.alert.body")).toBeTruthy());
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe("LfsAutoAttachmentsDialog.handleMigrate", () => {
	beforeEach(() => {
		mockFetch.mockReset();
		mockNotify.mockClear();
	});

	it("a successful enable settles with the real ok flag, mergeData and the resulting masks", async () => {
		const mergeData: MergeData = { ok: true };
		mockFetch.mockImplementation(async () => ({
			ok: true,
			json: async () => ({ migrated: true, mergeData, patterns: ["*.psd", "*.png"] }),
		}));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		clickMigrate();

		await waitFor(() => expect(onSettled).toHaveBeenCalledWith(true, mergeData, ["*.psd", "*.png"]));
	});

	it("a failed enable settles with false and never reads the response body", async () => {
		const json = jest.fn();
		mockFetch.mockImplementation(async () => ({ ok: false, json }));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		clickMigrate();

		await waitFor(() => expect(onSettled).toHaveBeenCalledWith(false, undefined, undefined));
		expect(json).not.toHaveBeenCalled();
	});

	it("a 200 that did not migrate settles with false and still forwards the merge data", async () => {
		const mergeData: MergeData = { ok: false, mergeFiles: [], reverseMerge: false, caller: undefined };
		mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ migrated: false, mergeData }) }));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		clickMigrate();

		await waitFor(() => expect(onSettled).toHaveBeenCalledWith(false, mergeData, undefined));
	});

	it("a committed-then-failed migration settles with the real masks and still reports the failure", async () => {
		mockFetch.mockImplementation(async () => ({
			ok: true,
			json: async () => ({
				migrated: true,
				mergeData: { ok: true },
				patterns: ["*.psd", "*.png"],
				error: "push rejected",
			}),
		}));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		clickMigrate();

		await waitFor(() => expect(onSettled).toHaveBeenCalledWith(true, { ok: true }, ["*.psd", "*.png"]));
		expect(mockNotify).toHaveBeenCalledTimes(1);
		expect(mockNotify.mock.calls[0][0]).toMatchObject({ message: "push rejected" });
	});

	it("a plain successful enable notifies nothing", async () => {
		mockFetch.mockImplementation(async () => ({
			ok: true,
			json: async () => ({ migrated: true, mergeData: { ok: true }, patterns: [] }),
		}));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		clickMigrate();

		await waitFor(() => expect(onSettled).toHaveBeenCalledWith(true, { ok: true }, []));
		expect(mockNotify).not.toHaveBeenCalled();
	});

	it("a thrown fetch settles with false and leaves the dialog dismissible", async () => {
		const enableError = new Error("network down");
		mockFetch.mockImplementation(() => Promise.reject(enableError));
		const onSettled = jest.fn();

		renderDialog(onSettled);

		await act(async () => {
			clickMigrate();
			await expect(lastClick).rejects.toBe(enableError);
		});

		expect(onSettled).toHaveBeenCalledWith(false);
		expect((screen.getByText("git.lfs-auto-attachments.alert.cancel") as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(screen.getByText("git.lfs-auto-attachments.alert.cancel"));
		expect(onSettled).toHaveBeenCalledTimes(2);
		expect(onSettled).toHaveBeenNthCalledWith(2, false);
	});
});
