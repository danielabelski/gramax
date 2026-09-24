import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import FolderCardsGrid from "./FolderCardsGrid";

jest.mock("../Card", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest's ESM interop flag has this fixed name.
	__esModule: true,
	default: ({ name }: { name: string }) => require("react").createElement("div", null, name),
}));
jest.mock("./FolderCardsDnd", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest's ESM interop flag has this fixed name.
	__esModule: true,
	default: () => require("react").createElement("div", { "data-testid": "folder-dnd" }),
}));

describe("FolderCardsGrid", () => {
	test("does not enable dnd without callbacks that persist folder edits", async () => {
		render(
			createElement(FolderCardsGrid, {
				items: ["guide"],
				linkByName: { guide: { name: "guide" } as never },
				setIsAnyCardLoading: () => {},
				editMode: true,
			}),
		);

		expect(screen.getByText("guide")).toBeTruthy();
		await waitFor(() => expect(screen.queryByTestId("folder-dnd")).toBeNull());
	});
});
