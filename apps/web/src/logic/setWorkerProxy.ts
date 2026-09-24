const setWorkerProxy = (corsProxy: string | null) => {
	(window as unknown as { wasm?: Worker })?.wasm?.postMessage?.({ type: "set-proxy", corsProxy });
};

export default setWorkerProxy;
