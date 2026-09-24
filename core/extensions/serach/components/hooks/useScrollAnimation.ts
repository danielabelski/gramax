import { createScrollAnimation, type ScrollAnimation } from "@ext/serach/components/utils/scrollToElement";
import { useEffect, useRef } from "react";

export const useScrollAnimation = (): ScrollAnimation => {
	const animationRef = useRef<ScrollAnimation>();
	animationRef.current ??= createScrollAnimation();

	useEffect(() => {
		const animation = animationRef.current;
		return () => animation.cancel();
	}, []);

	return animationRef.current;
};
