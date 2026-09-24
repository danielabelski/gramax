import { useEffect } from "react";
import { RESIZE_CLAMP_DEBOUNCE_MS } from "../constants";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";

export const useClampFloatingPanelsOnResize = () => {
	const clampPositions = useFloatingPanelStore((state) => state.clampPositions);

	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout>;

		const handleResize = () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				clampPositions({ width: window.innerWidth, height: window.innerHeight });
			}, RESIZE_CLAMP_DEBOUNCE_MS);
		};

		window.addEventListener("resize", handleResize);
		return () => {
			clearTimeout(timeout);
			window.removeEventListener("resize", handleResize);
		};
	}, [clampPositions]);
};
