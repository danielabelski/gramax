/** biome-ignore-all lint/suspicious/noExplicitAny: the stubs stand in for whole ui-kit primitives */
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

jest.mock("@ui-kit/Input", () => {
	const react = require("react");
	return {
		Input: react.forwardRef((props: any, ref: any) => react.createElement("input", { ...props, ref })),
	};
});

jest.mock("@ui-kit/SearchSelect", () => {
	const react = require("react");
	return {
		// A tag is its label plus, unless it is readonly, the button that takes it out — the one thing
		// these cases are about.
		SearchSelectTag: ({
			children,
			onClose,
			readonly,
		}: {
			children?: ReactNode;
			onClose: any;
			readonly?: boolean;
		}) =>
			react.createElement(
				"span",
				{ "data-tag": children },
				children,
				readonly ? null : react.createElement("button", { onClick: onClose, type: "button" }, "×"),
			),
	};
});

import TagInputWithKeyboard from "./TagInputWithKeyboard";

const LOCKED = ["*.svg", "*.puml"];

const onChange = jest.fn();

const renderInput = (props: Partial<Parameters<typeof TagInputWithKeyboard>[0]> = {}) =>
	render(createElement(TagInputWithKeyboard, { value: ["*.psd"], lockedValues: LOCKED, onChange, ...props }));

const tags = () => [...document.querySelectorAll("[data-tag]")].map((el) => el.getAttribute("data-tag"));

const removeButtonOf = (tag: string) => document.querySelector(`[data-tag="${tag}"] button`);

beforeEach(() => onChange.mockClear());

describe("TagInputWithKeyboard with locked values", () => {
	it("shows the locked entries first and the rest after them", () => {
		renderInput({ value: ["*.psd", "*.gif"] });

		expect(tags()).toEqual([...LOCKED, "*.psd", "*.gif"]);
	});

	it("gives the locked entries no remove button, and the rest one each", () => {
		renderInput();

		for (const locked of LOCKED) expect(removeButtonOf(locked)).toBeNull();
		expect(removeButtonOf("*.psd")).not.toBeNull();
	});

	it("removes the entry that was clicked, not the one at its index in the visible list", () => {
		renderInput({ value: ["*.psd", "*.gif"] });

		fireEvent.click(removeButtonOf("*.gif"));

		expect(onChange).toHaveBeenCalledWith(["*.psd"]);
	});

	it("takes nothing out when Delete lands on a locked entry", () => {
		renderInput();

		// Focus starts on the first tag, which is a locked one; an empty input routes the key to the list.
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Delete" });

		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows a locked entry once even when the value repeats it", () => {
		renderInput({ value: ["*.svg", "*.psd"] });

		expect(tags()).toEqual([...LOCKED, "*.psd"]);
	});

	it("adds nothing when the typed entry is already locked", () => {
		renderInput();
		const input = screen.getByRole("textbox");

		fireEvent.change(input, { target: { value: "*.svg" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onChange).not.toHaveBeenCalled();
	});

	it("adds an entry the list does not carry yet", () => {
		renderInput();
		const input = screen.getByRole("textbox");

		fireEvent.change(input, { target: { value: "*.gif" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onChange).toHaveBeenCalledWith(["*.psd", "*.gif"]);
	});

	it("keeps every entry unremovable while the whole field is readonly", () => {
		renderInput({ readonly: true });

		expect(tags()).toEqual([...LOCKED, "*.psd"]);
		for (const tag of tags()) expect(removeButtonOf(tag)).toBeNull();
	});
});
