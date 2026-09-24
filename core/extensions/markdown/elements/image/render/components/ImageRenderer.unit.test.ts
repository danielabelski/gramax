import { ResourceError } from "@core-ui/ContextServices/ResourceService/errors";
import ImageRenderer from "@ext/markdown/elements/image/render/components/ImageRenderer";
import { act, render } from "@testing-library/react";
import { createElement } from "react";

let mockResourceCallback: (buffer?: Buffer, error?: ResourceError, signal?: AbortSignal) => Promise<void>;
const mockCropImage = jest.fn((..._args: unknown[]) => Promise.resolve(new Blob(["image"])));

const passthrough = () => {
	const react = require("react");
	return ({ children }: { children?: unknown }) => react.createElement("div", null, children);
};

jest.mock("@components/Atoms/Image/GifImage", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@components/Atoms/Image/Image", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@components/controls/HoverController/HoverableActions", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: passthrough(),
}));
jest.mock("@ext/article/Components/ArticleComponentResizer", () => ({
	ArticleComponentResizer: passthrough(),
}));
jest.mock("@ext/markdown/elements/comment/edit/components/View/BlockCommentView", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: passthrough(),
}));
jest.mock("@ext/markdown/elements/image/render/components/ObjectRenderer", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@core-ui/ContextServices/ArticleRef", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { value: { current: null } },
}));
jest.mock("@core-ui/ContextServices/ResourceService/ResourceService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { value: { getBuffer: () => undefined } },
}));
jest.mock("@core-ui/ContextServices/ResourceService/hooks/useGetResource", () => ({
	useGetResource: (callback: (buffer?: Buffer, error?: ResourceError, signal?: AbortSignal) => Promise<void>) => {
		mockResourceCallback = callback;
	},
}));
jest.mock("@core-ui/hooks/useElementInViewport", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/markdown/elements/image/render/hooks/useImageDecoded", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/markdown/elements/image/render/logic/cropImage", () => ({
	cropImage: (...args: unknown[]) => mockCropImage(...args),
}));

describe("ImageRenderer", () => {
	beforeEach(() => {
		mockCropImage.mockReset().mockImplementation(() => Promise.resolve(new Blob(["image"])));
		URL.createObjectURL = jest.fn(() => "blob:image");
		URL.revokeObjectURL = jest.fn();
	});

	it("reserves the image aspect ratio before the article width is measurable", () => {
		const { container } = render(
			createElement(ImageRenderer, {
				height: "1600px",
				realSrc: "image.png",
				width: "2400px",
			}),
		);

		const placeholder = container.querySelector("svg[data-image-placeholder]");
		expect(placeholder?.getAttribute("width")).toBe("2400");
		expect(placeholder?.getAttribute("height")).toBe("1600");
		expect(container.querySelector(".skeleton")?.classList.contains("absolute")).toBe(true);
		expect(container.querySelector(".skeleton")?.getAttribute("data-layout-reserved")).toBe("true");
	});

	it("keeps the reserved aspect ratio when loading fails", async () => {
		const { container } = render(
			createElement(ImageRenderer, {
				height: "1600px",
				realSrc: "image.png",
				width: "2400px",
			}),
		);

		await act(() => mockResourceCallback(undefined, new ResourceError("Image error", "image.png")));

		expect(container.querySelector("svg[data-image-placeholder]")).not.toBeNull();
	});

	it("reserves fallback space when intrinsic dimensions are unknown", () => {
		const { container } = render(createElement(ImageRenderer, { realSrc: "legacy-image.png" }));

		expect((container.querySelector(".skeleton") as HTMLElement).style.minHeight).toBe("12em");
	});

	it("removes unknown-size fallback space after loading fails", async () => {
		const { container } = render(createElement(ImageRenderer, { realSrc: "legacy-image.png" }));

		await act(() => mockResourceCallback(undefined, new ResourceError("Image error", "legacy-image.png")));

		expect((container.firstElementChild as HTMLElement).querySelector("[style*='min-height']")).toBeNull();
	});

	it("does not commit a crop whose resource delivery was invalidated", async () => {
		let resolveOldCrop: (blob: Blob) => void;
		mockCropImage
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveOldCrop = resolve;
					}),
			)
			.mockResolvedValueOnce(new Blob(["new-image"]));
		render(createElement(ImageRenderer, { realSrc: "image.png" }));
		const oldController = new AbortController();
		const oldCrop = mockResourceCallback(Buffer.from("old-image"), undefined, oldController.signal);

		oldController.abort();
		await act(() => mockResourceCallback(Buffer.from("new-image"), undefined, new AbortController().signal));
		await act(async () => {
			resolveOldCrop(new Blob(["old-image"]));
			await oldCrop;
		});

		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
	});
});
