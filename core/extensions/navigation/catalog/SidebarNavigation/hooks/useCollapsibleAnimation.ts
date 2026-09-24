import { type AnimationEvent, useCallback, useState } from "react";
import { useNavigationTreeStore } from "../store/navigationTreeStore";

export const useCollapsibleAnimation = (onOpenChange: (open: boolean) => void) => {
	const [animating, setAnimating] = useState(false);
	const notifyLayoutSettled = useNavigationTreeStore((s) => s.notifyLayoutSettled);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			const reduceMotion =
				typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
			setAnimating(!reduceMotion);
			onOpenChange(open);
		},
		[onOpenChange],
	);

	const handleAnimationEnd = useCallback(
		(event: AnimationEvent<HTMLElement>) => {
			if (event.target !== event.currentTarget) return;
			setAnimating(false);
			notifyLayoutSettled();
		},
		[notifyLayoutSettled],
	);

	return { animating, handleOpenChange, handleAnimationEnd };
};
