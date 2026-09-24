import t from "@ext/localization/locale/translate";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement, type ReactNode } from "react";
import { CollapsedRightNavigation } from "./CollapsedRightNavigation";

let mockHasLinksSectionContent = false;
let mockHasPropertiesSectionContent = true;

jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: () => ({ errorCode: undefined, tocItems: [{ id: "intro" }] }),
}));

// A real Popover trigger: the collapsed trigger is handed to it through a TooltipTrigger, and that
// chain only works while both stay Radix primitives.
jest.mock("@ext/catalog/views/components/CatalogView", () => ({
	CatalogView: ({ trigger }: { trigger?: ReactNode }) => {
		const { createElement: create } = require("react");
		const { Popover, PopoverContent, PopoverTrigger } = require("@ui-kit/Popover");

		if (!trigger) return null;

		return create(
			Popover,
			null,
			create(PopoverTrigger, { asChild: true }, trigger),
			create(PopoverContent, null, "catalog view content"),
		);
	},
}));

jest.mock("@ext/versioning/components/SwitchVersion", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: ({ trigger }: { trigger?: ReactNode }) => trigger ?? null,
}));

jest.mock("@ext/navigation/article/render/TableOfContents", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("./sections/LinksSection", () => ({
	LinksSectionContent: () => null,
	useLinksSectionData: () => ({ hasContent: mockHasLinksSectionContent }),
}));
jest.mock("./sections/ArticlePropertiesSection", () => ({
	ArticlePropertiesSectionContent: () => null,
	useArticlePropertiesSectionData: () => ({ hasContent: mockHasPropertiesSectionContent }),
}));

describe("CollapsedRightNavigation", () => {
	beforeEach(() => {
		mockHasLinksSectionContent = false;
		mockHasPropertiesSectionContent = true;
	});

	it("does not render actions when their section is empty", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(GlassToolbar, null, createElement(CollapsedRightNavigation)),
			),
		);

		expect(screen.getByRole("button", { name: t("catalog.views.trigger") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("in-article") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("versions.switch") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("properties.name") })).toBeTruthy();
		expect(screen.queryByRole("button", { name: t("actions") })).toBeNull();
	});

	it("opens the catalog view popover from the tooltip-wrapped trigger", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(GlassToolbar, null, createElement(CollapsedRightNavigation)),
			),
		);

		fireEvent.click(screen.getByRole("button", { name: t("catalog.views.trigger") }));

		expect(screen.getByText("catalog view content")).toBeTruthy();
	});

	it("does not render properties when their section is empty", () => {
		mockHasPropertiesSectionContent = false;

		render(
			createElement(
				TooltipProvider,
				null,
				createElement(GlassToolbar, null, createElement(CollapsedRightNavigation)),
			),
		);

		expect(screen.queryByRole("button", { name: t("properties.name") })).toBeNull();
	});

	it("renders actions when their section has content", () => {
		mockHasLinksSectionContent = true;

		render(
			createElement(
				TooltipProvider,
				null,
				createElement(GlassToolbar, null, createElement(CollapsedRightNavigation)),
			),
		);

		expect(screen.getByRole("button", { name: t("actions") })).toBeTruthy();
	});
});
