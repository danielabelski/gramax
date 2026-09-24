import { useCallback, useEffect, useState } from "react";

export interface UseSearchAiArgs {
	configured: boolean;
	probe: boolean;
	checkAvailable: () => Promise<boolean>;
}

export interface UseSearchAiResult {
	available: boolean;
	enabled: boolean;
	toggle: () => void;
}

export const useSearchAi = (args: UseSearchAiArgs): UseSearchAiResult => {
	const { configured, probe, checkAvailable } = args;
	const [probed, setProbed] = useState(false);
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		if (!configured || !probe) return;

		let cancelled = false;
		void checkAvailable().then((result) => {
			if (!cancelled) setProbed(result);
		});

		return () => {
			cancelled = true;
		};
	}, [configured, probe, checkAvailable]);

	const available = configured && (probe ? probed : true);

	const toggle = useCallback(() => {
		if (!available) return;
		setEnabled((prev) => !prev);
	}, [available]);

	return { available, enabled: available && enabled, toggle };
};
