/** biome-ignore-all lint/style/useNamingConvention: Jest ESM mock markers */

jest.mock("@core-ui/ContextServices/views/articleView/ArticleViewService", () => ({
	__esModule: true,
	default: { setDefaultBottomView: jest.fn() },
}));
jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	__esModule: true,
	default: { resetValue: jest.fn() },
}));
jest.mock("@ext/errorHandlers/client/ErrorConfirmService", () => ({
	__esModule: true,
	default: { notify: jest.fn() },
}));

import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import ErrorConfirmService from "@ext/errorHandlers/client/ErrorConfirmService";
import { useExportPdf } from "@ext/print/components/useExportPdf";
import { runPrint } from "@ext/print/utils/runPrint";
import { act, renderHook } from "@testing-library/react";

const tearDownPrintView = ArticleViewService.setDefaultBottomView as jest.Mock;
const notifyError = ErrorConfirmService.notify as jest.Mock;

const printWith = async (print: () => void | Promise<void>) => {
	const onClose = jest.fn();
	const { result } = renderHook(() => useExportPdf({ onClose }));
	const { handleComplete, handleError } = result.current;

	await act(() =>
		runPrint({ print, onComplete: handleComplete, onError: handleError, wait: () => Promise.resolve() }),
	);
	return { onClose };
};

describe("The PDF export's print view after printing", () => {
	afterEach(() => jest.clearAllMocks());

	test("is torn down once the print has finished, so it cannot reopen the print dialog or read a renamed article (gh#953, gh#966)", async () => {
		const { onClose } = await printWith(() => Promise.resolve());

		expect(tearDownPrintView).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(notifyError).not.toHaveBeenCalled();
	});

	test("stays mounted while the native print is still reading it (gh#981)", async () => {
		let finishPrinting: () => void;
		const printing = new Promise<void>((resolve) => {
			finishPrinting = resolve;
		});
		const { result } = renderHook(() => useExportPdf({}));
		const { handleComplete, handleError } = result.current;

		let running: Promise<void>;
		await act(async () => {
			running = runPrint({
				print: () => printing,
				onComplete: handleComplete,
				onError: handleError,
				wait: () => Promise.resolve(),
			});
			await new Promise((resolve) => setTimeout(resolve, 100));
		});
		expect(tearDownPrintView).not.toHaveBeenCalled();

		await act(async () => {
			finishPrinting();
			await running;
		});
		expect(tearDownPrintView).toHaveBeenCalledTimes(1);
	});

	test("is torn down without an error when print() completes synchronously", async () => {
		await printWith(() => undefined);

		expect(tearDownPrintView).toHaveBeenCalledTimes(1);
		expect(notifyError).not.toHaveBeenCalled();
	});

	test("is torn down and the error shown when the print fails", async () => {
		await printWith(() => Promise.reject(new Error("print operation failed")));

		expect(tearDownPrintView).toHaveBeenCalledTimes(1);
		expect(notifyError).toHaveBeenCalledTimes(1);
	});
});
