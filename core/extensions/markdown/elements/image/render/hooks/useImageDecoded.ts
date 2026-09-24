import { type RefObject, useEffect, useState } from "react";

const useImageDecoded = (imageRef: RefObject<HTMLImageElement>, src?: string): boolean => {
	const [decodedSrc, setDecodedSrc] = useState<string>();

	useEffect(() => {
		if (!src) return;
		const image = imageRef.current;
		if (!image) return;

		let cancelled = false;
		let waitingForLoad = false;
		const markDecoded = () => {
			if (!cancelled) setDecodedSrc(src);
		};
		const waitForLoad = () => {
			if (cancelled) return;
			if (image.complete && image.naturalWidth > 0) {
				markDecoded();
				return;
			}

			waitingForLoad = true;
			image.addEventListener("load", markDecoded, { once: true });
		};

		if (typeof image.decode !== "function") {
			markDecoded();
			return;
		}

		void image.decode().then(markDecoded, waitForLoad);

		return () => {
			cancelled = true;
			if (waitingForLoad) image.removeEventListener("load", markDecoded);
		};
	}, [imageRef, src]);

	return !!src && decodedSrc === src;
};

export default useImageDecoded;
