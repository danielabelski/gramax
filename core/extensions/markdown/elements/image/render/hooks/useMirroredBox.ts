import { type RefObject, useLayoutEffect } from "react";

const MIRRORED_STYLES = ["left", "top", "width", "height", "marginLeft", "marginTop"] as const;

const useMirroredBox = (sourceRef: RefObject<HTMLElement>, targetRef: RefObject<HTMLElement>, enabled: boolean) => {
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable; the layer mounts in the same commit that flips `enabled`
	useLayoutEffect(() => {
		const source = sourceRef.current;
		if (!enabled || !source) return;

		const sync = () => {
			const target = targetRef.current;
			if (!target) return;
			for (const key of MIRRORED_STYLES) target.style[key] = source.style[key];
		};

		sync();
		const observer = new MutationObserver(sync);
		observer.observe(source, { attributes: true, attributeFilter: ["style"] });
		return () => observer.disconnect();
	}, [enabled]);
};

export default useMirroredBox;
