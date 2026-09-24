export const PRINT_SETTLE_DELAY_MS = 50;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type RunPrintParams = {
	onComplete?: () => void;
	onError?: (error: Error) => void;
	/** The browser print entry point. Injectable for tests; defaults to `window.print`. */
	print?: () => void | Promise<void>;
	wait?: (ms: number) => Promise<void>;
};

export const runPrint = async ({
	onComplete,
	onError,
	print = () => window.print(),
	wait = defaultWait,
}: RunPrintParams): Promise<void> => {
	try {
		await wait(PRINT_SETTLE_DELAY_MS);
		// macOS desktop replaces window.print with a Tauri command that resolves after the native print operation.
		// Keep awaiting it: completing earlier tears the paginated view down while the printer is still reading it.
		await print();
		onComplete?.();
	} catch (error) {
		onError?.(error as Error);
	}
};
