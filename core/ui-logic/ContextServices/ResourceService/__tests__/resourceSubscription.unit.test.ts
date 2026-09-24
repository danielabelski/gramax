import { useGetResource } from "@core-ui/ContextServices/ResourceService/hooks/useGetResource";
import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import {
	ResourceStoreProvider,
	type ResourceStoreProviderProps,
	useResourceStoreContext,
} from "@core-ui/ContextServices/ResourceService/store/ResourceStore.provider";
import { loadInternalData } from "@core-ui/ContextServices/ResourceService/utils/utils";
import { act, render } from "@testing-library/react";
import { createElement, Fragment, type ReactElement } from "react";

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { value: {} },
}));

jest.mock("@core-ui/ContextServices/ResourceService/utils/utils", () => ({
	checkLfsPointer: () => undefined,
	loadInternalData: jest.fn(() => new Promise(() => {})),
	loadExternalData: jest.fn(() => new Promise(() => {})),
	getNoParentResource: jest.fn(() => new Promise(() => {})),
}));

interface ProbeReport {
	renders: number;
	buffers: string[];
}

const reports = new Map<string, ProbeReport>();

const reportFor = (src: string): ProbeReport => {
	if (!reports.has(src)) reports.set(src, { renders: 0, buffers: [] });
	return reports.get(src);
};

const Probe = ({ src }: { src: string }): ReactElement => {
	reportFor(src).renders += 1;
	useGetResource((buffer) => {
		reportFor(src).buffers.push(buffer?.toString());
	}, src);
	return null;
};

const printCallbackResolvers: (() => void)[] = [];
const printCallbackSources: string[] = [];

const PrintProbe = ({ src = "a.png" }: { src?: string }): ReactElement => {
	useGetResource(
		() =>
			new Promise((resolve) => {
				printCallbackSources.push(src);
				printCallbackResolvers.push(resolve);
			}),
		src,
		undefined,
		true,
		true,
	);
	return null;
};

let storeApi: ReturnType<typeof useResourceStoreContext>;
let serviceValues: ResourceServiceType[] = [];

const Capture = (): ReactElement => {
	storeApi = useResourceStoreContext();
	serviceValues.push(ResourceService.value);
	return null;
};

const Harness = (): ReactElement =>
	createElement(
		ResourceStoreProvider,
		null,
		createElement(
			Fragment,
			null,
			createElement(Capture),
			createElement(Probe, { src: "a.png" }),
			createElement(Probe, { src: "b.png" }),
		),
	);

const SingleResourceHarness = ({ id }: { id: string }): ReactElement => {
	const providerProps = { id } as ResourceStoreProviderProps;
	return createElement(
		ResourceStoreProvider,
		providerProps,
		createElement(Fragment, null, createElement(Capture), createElement(Probe, { src: "a.png" })),
	);
};

const PrintHarness = (): ReactElement =>
	createElement(
		ResourceStoreProvider,
		null,
		createElement(Fragment, null, createElement(Capture), createElement(PrintProbe)),
	);

const MultiPrintHarness = (): ReactElement =>
	createElement(
		ResourceStoreProvider,
		null,
		createElement(
			Fragment,
			null,
			createElement(Capture),
			createElement(PrintProbe, { src: "a.png" }),
			createElement(PrintProbe, { src: "b.png" }),
		),
	);

beforeEach(() => {
	reports.clear();
	serviceValues = [];
	storeApi = undefined;
	printCallbackResolvers.length = 0;
	printCallbackSources.length = 0;
	ResourceService._loadingPromises.clear();
	jest.mocked(loadInternalData)
		.mockReset()
		.mockImplementation(() => new Promise(() => {}));
});

describe("resource delivery", () => {
	it("delivers an arriving resource without rerendering unrelated consumers", () => {
		render(createElement(Harness));
		const rendersBefore = [reportFor("a.png").renders, reportFor("b.png").renders];

		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));

		expect(reportFor("a.png").buffers).toEqual(["a-bytes"]);
		expect(reportFor("b.png").buffers).toEqual([]);
		expect([reportFor("a.png").renders, reportFor("b.png").renders]).toEqual(rendersBefore);
	});

	it("keeps the service context identity when a resource arrives", () => {
		render(createElement(Harness));
		const value = serviceValues.at(-1);

		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));

		expect(serviceValues.at(-1)).toBe(value);
		expect(value.data["a.png"].toString()).toBe("a-bytes");
	});

	it("does not redeliver identical bytes after cache invalidation", () => {
		render(createElement(Harness));

		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));
		act(() => storeApi.getState().clear());
		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));

		expect(reportFor("a.png").buffers).toEqual(["a-bytes"]);

		act(() => storeApi.getState().update("a.png", Buffer.from("changed-bytes")));
		expect(reportFor("a.png").buffers).toEqual(["a-bytes", "changed-bytes"]);
	});

	it("ignores a late response from the previous resource scope", async () => {
		const resolveById = new Map<string, (result: { buffer: Buffer }) => void>();
		let previousScopeSignal: AbortSignal;
		jest.mocked(loadInternalData).mockImplementation(
			({ id, signal }) =>
				new Promise((resolve) => {
					if (id === "catalog-a") previousScopeSignal = signal;
					resolveById.set(id, resolve);
				}),
		);
		const view = render(createElement(SingleResourceHarness, { id: "catalog-a" }));

		view.rerender(createElement(SingleResourceHarness, { id: "catalog-b" }));
		await act(() => Promise.resolve());
		expect(previousScopeSignal.aborted).toBe(true);
		await act(() => {
			resolveById.get("catalog-a")({ buffer: Buffer.from("a-bytes") });
			return Promise.resolve();
		});
		await act(() => {
			resolveById.get("catalog-b")({ buffer: Buffer.from("b-bytes") });
			return Promise.resolve();
		});

		expect(storeApi.getState().data["a.png"].toString()).toBe("b-bytes");
		expect(reportFor("a.png").buffers).toEqual(["b-bytes"]);
	});

	it("keeps print waiting when an invalidated callback finishes late", async () => {
		render(createElement(PrintHarness));
		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));
		act(() => storeApi.getState().clear());
		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));
		expect(printCallbackResolvers).toHaveLength(2);

		let finished = false;
		const wait = ResourceService.waitForAllLoads().then(() => {
			finished = true;
		});
		await act(async () => {
			printCallbackResolvers[0]();
			await Promise.resolve();
		});
		expect(finished).toBe(false);

		await act(async () => {
			printCallbackResolvers[1]();
			await wait;
		});
		expect(finished).toBe(true);
	});

	it("does not redeliver print resources after an unrelated store update", () => {
		render(createElement(MultiPrintHarness));

		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));
		act(() => storeApi.getState().update("b.png", Buffer.from("b-bytes")));

		expect(printCallbackSources).toEqual(["a.png", "b.png"]);
	});

	it("finishes the current print generation when its consumer unmounts", async () => {
		const view = render(createElement(PrintHarness));
		act(() => storeApi.getState().update("a.png", Buffer.from("a-bytes")));
		act(() => storeApi.getState().clear());

		view.unmount();
		await act(() => Promise.resolve());

		expect(ResourceService._loadingPromises.size).toBe(0);
	});
});
