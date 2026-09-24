import React, { type ReactElement } from "react";
import ErrorHandler, { type ErrorHandlerProps } from "./ErrorHandler";

class TestErrorHandler extends ErrorHandler {
	override renderError(): ReactElement {
		return React.createElement("div", null, "render error");
	}
}

describe("ErrorHandler", () => {
	test("clears a captured error when its reset key changes", () => {
		const previousProps: ErrorHandlerProps = { children: null, resetKey: "first" };
		const handler = new TestErrorHandler({ children: null, resetKey: "second" });
		handler.state = { error: new Error("failed article") };
		const setState = jest.spyOn(handler, "setState").mockImplementation(() => undefined);

		handler.componentDidUpdate(previousProps);

		expect(setState).toHaveBeenCalledWith({ error: null });
	});
});
