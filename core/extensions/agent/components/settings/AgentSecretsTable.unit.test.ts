import t from "@ext/localization/locale/translate";
import { zodResolver } from "@hookform/resolvers/zod";
import { act, fireEvent, render, within } from "@testing-library/react";
import { webcrypto } from "crypto";
import { createElement } from "react";
import { type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { AgentSecretsTable } from "./AgentSecretsTable";
import { type AgentSecretsFormData, agentSecretsFormSchema } from "./secretRow";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

// jsdom reports `offsetHeight === 0` for every element, and that is exactly what
// @tanstack/react-virtual measures the scroll container with. A zero-height container means no
// visible range, so the virtualizer renders zero rows and every query below finds nothing. Give
// elements a height for the duration of this file so the table has a window to fill.
const SCROLL_CONTAINER_HEIGHT_PX = 600;
const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeAll(() => {
	Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
		configurable: true,
		value: SCROLL_CONTAINER_HEIGHT_PX,
	});
});

afterAll(() => {
	if (offsetHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeightDescriptor);
});

const noopCommit = async () => true;
const noopDelete = () => {};

const TestTable = ({
	rows,
	onDeleteRow = noopDelete,
}: {
	rows: AgentSecretsFormData["rows"];
	onDeleteRow?: (index: number) => void;
}) => {
	const form = useForm<AgentSecretsFormData>({
		resolver: zodResolver(agentSecretsFormSchema),
		defaultValues: { rows },
		mode: "onChange",
	});

	// Real Radix Tooltip needs a provider ancestor; require avoids import-organizer churn.
	const { TooltipProvider } = require("@ui-kit/Tooltip");
	return createElement(
		TooltipProvider,
		null,
		createElement(AgentSecretsTable, {
			form,
			rows: rows.map((row, index) => ({ id: row.id, index })),
			onFieldCommit: noopCommit,
			onDeleteRow,
		}),
	);
};

describe("AgentSecretsTable — key field error visibility", () => {
	test("typing a duplicate key opens a tooltip and leaves the input border untouched", async () => {
		const { getAllByPlaceholderText, findAllByText } = render(
			createElement(TestTable, {
				rows: [
					{ id: "row-1", key: "GitHub", savedKey: "GitHub", value: "a", kind: "token", login: "", url: "" },
					{ id: "row-2", key: "", savedKey: "", value: "b", kind: "token", login: "", url: "" },
				],
			}),
		);

		const [, row2Key] = getAllByPlaceholderText(t("app-settings.keys-passwords.key-placeholder"));
		await act(async () => {
			fireEvent.change(row2Key, { target: { value: "GitHub" } });
		});

		expect((await findAllByText(t("app-settings.keys-passwords.key-duplicate"))).length).toBeGreaterThan(0);
		expect(row2Key.getAttribute("aria-invalid")).not.toBe("true");
	});

	test("an empty key gets no red border", async () => {
		const { getByPlaceholderText } = render(
			createElement(TestTable, {
				rows: [
					{ id: "row-1", key: "GitHub", savedKey: "GitHub", value: "a", kind: "token", login: "", url: "" },
				],
			}),
		);

		const keyInput = getByPlaceholderText(t("app-settings.keys-passwords.key-placeholder"));
		await act(async () => {
			fireEvent.change(keyInput, { target: { value: "" } });
		});

		expect(keyInput.getAttribute("aria-invalid")).not.toBe("true");
	});

	test("blurring a freshly focused, still-empty key input leaves it unmarked", async () => {
		const { getByPlaceholderText } = render(
			createElement(TestTable, {
				rows: [{ id: "row-1", key: "", savedKey: "", value: "", kind: "token", login: "", url: "" }],
			}),
		);

		const keyInput = getByPlaceholderText(t("app-settings.keys-passwords.key-placeholder"));
		keyInput.focus();
		await act(async () => {
			fireEvent.blur(keyInput);
		});

		expect(keyInput.getAttribute("aria-invalid")).not.toBe("true");
	});

	test("editing the value field while the key is still focused doesn't remount (and unfocus) the key input", async () => {
		const { getAllByPlaceholderText } = render(
			createElement(TestTable, {
				rows: [
					{ id: "row-1", key: "GitHub", savedKey: "GitHub", value: "a", kind: "token", login: "", url: "" },
					{ id: "row-2", key: "", savedKey: "", value: "", kind: "token", login: "", url: "" },
				],
			}),
		);

		const [, row2Key] = getAllByPlaceholderText(t("app-settings.keys-passwords.key-placeholder"));
		const [, row2Value] = getAllByPlaceholderText(t("app-settings.keys-passwords.value-placeholder"));

		row2Key.focus();
		await act(async () => {
			// Duplicate the key first so the field carries an error and re-renders through the Tooltip branch.
			fireEvent.change(row2Key, { target: { value: "GitHub" } });
		});
		expect(document.activeElement).toBe(row2Key);

		row2Key.focus();
		await act(async () => {
			fireEvent.change(row2Value, { target: { value: "secret" } });
		});

		expect(document.activeElement).toBe(row2Key);
	});
});

describe("AgentSecretsTable — delete confirmation", () => {
	test("a never-saved (draft) row deletes immediately without a confirmation dialog", async () => {
		const onDeleteRow = jest.fn();
		const { getAllByLabelText, queryByRole } = render(
			createElement(TestTable, {
				rows: [{ id: "row-1", key: "GitHub", savedKey: "", value: "a", kind: "token", login: "" }],
				onDeleteRow,
			}),
		);

		const [deleteButton] = getAllByLabelText(t("delete"));
		await act(async () => {
			fireEvent.click(deleteButton);
		});

		expect(onDeleteRow).toHaveBeenCalledWith(0);
		expect(queryByRole("alertdialog")).toBeNull();
	});

	test("a saved row opens a confirmation dialog, and confirming deletes the row by id even if the array shifted meanwhile", async () => {
		const onDeleteRow = jest.fn();
		let formRef: UseFormReturn<AgentSecretsFormData>;

		const Harness = () => {
			const form = useForm<AgentSecretsFormData>({
				resolver: zodResolver(agentSecretsFormSchema),
				defaultValues: {
					rows: [
						{ id: "row-1", key: "GitHub", savedKey: "GitHub", value: "a", kind: "token", login: "" },
						{ id: "row-2", key: "GitLab", savedKey: "GitLab", value: "b", kind: "login", login: "user" },
					],
				},
				mode: "onChange",
			});
			formRef = form;
			const liveRows = useWatch({ control: form.control, name: "rows" });

			// Real Radix Tooltip needs a provider ancestor; require avoids import-organizer churn.
			const { TooltipProvider } = require("@ui-kit/Tooltip");
			return createElement(
				TooltipProvider,
				null,
				createElement(AgentSecretsTable, {
					form,
					rows: liveRows.map((row, index) => ({ id: row.id, index })),
					onFieldCommit: noopCommit,
					onDeleteRow,
				}),
			);
		};

		const { getAllByLabelText, findByRole } = render(createElement(Harness));

		// Click delete on row-2 ("GitLab", a login secret), currently at index 1.
		const deleteButtons = getAllByLabelText(t("delete"));
		await act(async () => {
			fireEvent.click(deleteButtons[1]);
		});

		const dialog = await findByRole("alertdialog");
		expect(within(dialog).getByText(t("app-settings.keys-passwords.delete-confirm-title-login"))).toBeTruthy();

		// A row gets prepended between the click and the confirm — row-2 shifts from index 1 to index 2.
		act(() => {
			formRef.setValue("rows", [
				{ id: "row-3", key: "New", savedKey: "", value: "", kind: "token", login: "" },
				...formRef.getValues("rows"),
			]);
		});

		const confirmButton = within(dialog).getByRole("button", { name: t("delete") });
		await act(async () => {
			fireEvent.click(confirmButton);
		});

		expect(onDeleteRow).toHaveBeenCalledWith(2);
	});
});
