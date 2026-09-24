export type ScrollGuardStore = {
	hasOpenGuard: () => boolean;
	registerOpenGuard: () => () => void;
};

export const createScrollGuardStore = (): ScrollGuardStore => {
	let openGuardCount = 0;

	return {
		hasOpenGuard: () => openGuardCount > 0,
		registerOpenGuard: () => {
			openGuardCount++;
			let released = false;
			return () => {
				if (released) return;
				released = true;
				openGuardCount = Math.max(0, openGuardCount - 1);
			};
		},
	};
};
