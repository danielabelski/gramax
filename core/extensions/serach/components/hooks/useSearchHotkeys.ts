import { useEffect, useRef } from "react";

export interface UseSearchHotkeysArgs {
	onToggleOpen: () => void;
	onCycleScope: () => void;
}

export const useSearchHotkeys = (args: UseSearchHotkeysArgs): void => {
	const argsRef = useRef(args);
	argsRef.current = args;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;

			if (e.code === "Slash") {
				e.preventDefault();
				argsRef.current.onToggleOpen();
				return;
			}

			if (e.code === "Enter") {
				e.preventDefault();
				argsRef.current.onCycleScope();
			}
		};

		document.addEventListener("keydown", onKeyDown, false);
		return () => document.removeEventListener("keydown", onKeyDown, false);
	}, []);
};
