import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const FloatingPanelLayer = ({ children }: { children: ReactNode }) => {
	const [isMounted, setIsMounted] = useState(false);
	useEffect(() => setIsMounted(true), []);

	if (!isMounted) return null;

	return createPortal(
		<div className="pointer-events-none fixed inset-0 z-[var(--z-index-floating-panel)] print:hidden [&>*]:pointer-events-auto">
			{children}
		</div>,
		document.body,
	);
};
