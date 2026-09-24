import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { navigationTreeStore } from "../../store/navigationTreeStore";
import { AddRootArticleRow } from "./AddRootArticleRow";

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

describe("AddRootArticleRow", () => {
	it("is a button named by its text that creates the article after the last root", () => {
		const onCreateArticle = jest.fn().mockResolvedValue(undefined);
		navigationTreeStore.setState({ rootIds: ["first", "last"], onCreateArticle });
		render(createElement(AddRootArticleRow));

		fireEvent.click(screen.getByRole("button", { name: "article.add" }));

		expect(onCreateArticle).toHaveBeenCalledWith(undefined, "last");
	});

	it("creates the first article of an empty catalog", () => {
		const onCreateArticle = jest.fn().mockResolvedValue(undefined);
		navigationTreeStore.setState({ rootIds: [], onCreateArticle });
		render(createElement(AddRootArticleRow));

		fireEvent.click(screen.getByRole("button", { name: "article.add" }));

		expect(onCreateArticle).toHaveBeenCalledWith(undefined, undefined);
	});
});
