import { render, screen } from "@testing-library/react";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { type ComponentProps, createElement } from "react";
import { MenuItem } from "./MenuItem";

const renderItem = (variant?: "glass" | "inverse") =>
	render(
		createElement(
			ComponentVariantProvider,
			{ variant } as ComponentProps<typeof ComponentVariantProvider>,
			createElement(MenuItem, { "data-testid": "item" } as never, "item"),
		),
	);

describe("MenuItem surfaces", () => {
	test("glass variant drops the opaque default surface", () => {
		renderItem("glass");

		const item = screen.getByTestId("item");
		expect(item.className).toContain("bg-transparent");
		expect(item.className).not.toContain("bg-secondary-bg");
	});

	test("default variant keeps the opaque surface", () => {
		renderItem();

		expect(screen.getByTestId("item").className).toContain("bg-secondary-bg");
	});
});
