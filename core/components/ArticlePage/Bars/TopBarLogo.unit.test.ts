import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { TopBarLogo } from "./TopBarLogo";

const mockPageData = {
	conf: { logo: { imageUrl: undefined as string, linkUrl: "https://site.example", linkTitle: undefined as string } },
};
const mockCatalogProps = { name: "catalog", title: "Gramax Docs", link: { pathname: "/catalog" } };

jest.mock("@components/Atoms/Link", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: ({ href, children, ...props }: { href: { pathname: string }; children: React.ReactNode }) =>
		require("react").createElement("a", { href: href.pathname, ...props }, children),
}));
jest.mock("@core-ui/ContextServices/CatalogLogoService/Context", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: () => ({ logo: { src: "/catalog-logo.png" } }) },
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: {
		get value() {
			return mockPageData;
		},
	},
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({ usePlatform: () => ({ isStaticCli: false }) }));
jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (state: unknown) => unknown) => selector({ data: mockCatalogProps }),
}));
jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: (key: string) => key,
}));
jest.mock("@ui-kit/Tooltip", () => ({
	TextOverflowTooltip: ({ children }: { children: React.ReactNode }) =>
		require("react").createElement("span", null, children),
}));

describe("TopBarLogo", () => {
	beforeEach(() => {
		mockPageData.conf.logo = { imageUrl: undefined, linkUrl: "https://site.example", linkTitle: undefined };
	});

	it("keeps the catalog logo inside the single catalog link when no site logo is configured", () => {
		render(createElement(TopBarLogo));

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("/catalog");
		expect(links[0].querySelector("[data-testid='catalog-logo-image']")).not.toBeNull();
	});

	it("splits the site logo and the catalog title into two separate links", () => {
		mockPageData.conf.logo.imageUrl = "/site-logo.png";
		render(createElement(TopBarLogo));

		const [siteLink, catalogLink] = screen.getAllByRole("link");
		expect(screen.getAllByRole("link")).toHaveLength(2);
		expect(siteLink.getAttribute("href")).toBe("https://site.example");
		expect(siteLink.querySelector("img")).not.toBeNull();
		expect(catalogLink.getAttribute("href")).toBe("/catalog");
		expect(catalogLink.textContent).toBe("Gramax Docs");
		expect(catalogLink.querySelector("img")).toBeNull();
	});

	it("drops the site logo link when its image fails to load", () => {
		mockPageData.conf.logo.imageUrl = "/site-logo.png";
		render(createElement(TopBarLogo));

		fireEvent.error(screen.getAllByRole("link")[0].querySelector("img"));

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("/catalog");
	});
});
