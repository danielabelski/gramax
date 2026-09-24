import { once } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { httpListenOnce } from "../../../../apps/tauri/src/window/commands";

const CALLBACK_TIMEOUT = 1000 * 60 * 6;

const gesCloudPaymentMethodBinding = async (url: string): Promise<void> => {
	const callbackName = `payment_method_binding_done_${Date.now()}`;
	let resolveCallback: () => void;
	let rejectCallback: (error: unknown) => void;
	const callback = new Promise<void>((resolve, reject) => {
		resolveCallback = resolve;
		rejectCallback = reject;
	});

	const unlisten = await once(callbackName, () => {
		const appWindow = getCurrentWindow();
		void appWindow
			.show()
			.then(() => appWindow.unminimize())
			.then(() => appWindow.setFocus())
			.then(resolveCallback)
			.catch(rejectCallback);
	});

	const timeout = setTimeout(
		() => rejectCallback(new Error("Payment method binding callback timed out")),
		CALLBACK_TIMEOUT,
	);

	try {
		await httpListenOnce({ url, action: { type: "tryClose" }, callbackName });
		await callback;
	} finally {
		clearTimeout(timeout);
		unlisten();
	}
};

export default gesCloudPaymentMethodBinding;
