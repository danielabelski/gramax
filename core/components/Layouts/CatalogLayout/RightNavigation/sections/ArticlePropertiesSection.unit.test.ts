import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { ArticlePropertiesSectionContent } from "./ArticlePropertiesSection";

jest.mock("@ext/properties/components/Helpers/Properties", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: ({ trigger }: { trigger: ReactNode }) => {
		const React = jest.requireActual<typeof import("react")>("react");
		return React.createElement("div", null, trigger, React.createElement("div", null, "property-values"));
	},
	PropertyList: () => {
		const React = jest.requireActual<typeof import("react")>("react");
		return React.createElement("div", null, "property-values");
	},
	PropertyMenu: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

describe("ArticlePropertiesSectionContent", () => {
	it("renders property values below the section header", () => {
		const { container } = render(
			createElement(ArticlePropertiesSectionContent, {
				catalogProperties: new Map(),
				isReadOnly: false,
				onDelete: jest.fn(),
				onSubmit: jest.fn(),
				properties: [],
			}),
		);

		const groupHeader = container.querySelector(".group-header");
		expect(groupHeader?.contains(screen.getByText("property-values"))).toBe(false);

		const addPropertyButton = screen.getByRole("button", { name: "Add property" });
		expect(addPropertyButton.classList.contains("ml-auto")).toBe(true);
		expect(addPropertyButton.classList.contains("absolute")).toBe(false);
	});
});
