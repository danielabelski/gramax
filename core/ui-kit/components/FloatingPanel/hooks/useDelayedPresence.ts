import { useEffect, useState } from "react";

export const useDelayedPresence = (isOpen: boolean, exitDuration: number) => {
	const [isPresent, setIsPresent] = useState(isOpen);

	useEffect(() => {
		if (isOpen) {
			setIsPresent(true);
			return;
		}

		const timeout = setTimeout(() => setIsPresent(false), exitDuration);
		return () => clearTimeout(timeout);
	}, [exitDuration, isOpen]);

	return isPresent;
};
