import { getDraftTransition, isInboxDraftEmpty } from "./inboxEditingSession";

describe("inbox editing session", () => {
	it("commits a draft with a title before switching editing context", () => {
		expect(getDraftTransition({ title: "Review spacing", content: "" })).toBe("commit");
	});

	it("commits a draft with content before switching editing context", () => {
		expect(getDraftTransition({ title: "", content: "Check the heading" })).toBe("commit");
	});

	it("closes an empty draft without saving before switching editing context", () => {
		expect(getDraftTransition({ title: "   ", content: "\n" })).toBe("close");
	});

	it("disables saving only when both draft fields are empty", () => {
		expect(isInboxDraftEmpty({ title: "", content: "" })).toBe(true);
		expect(isInboxDraftEmpty({ title: "Untitled", content: "" })).toBe(false);
		expect(isInboxDraftEmpty({ title: "", content: "Body" })).toBe(false);
	});
});
