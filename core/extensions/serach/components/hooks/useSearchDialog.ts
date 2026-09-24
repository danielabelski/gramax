import type { CatalogSearchScope } from "@ext/serach/components/model/searchScope";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SearchOpenRequest {
	has: boolean;
	scope?: CatalogSearchScope;
	clear: () => void;
}

export interface UseSearchDialogArgs {
	openRequest: SearchOpenRequest;
	canApplyRequestedScope: boolean;
	onApplyScope: (scope: CatalogSearchScope) => void;
}

export interface UseSearchDialogResult {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

export const useSearchDialog = (args: UseSearchDialogArgs): UseSearchDialogResult => {
	const [open, setOpen] = useState(false);

	const argsRef = useRef(args);
	argsRef.current = args;

	const toggle = useCallback(() => setOpen((current) => !current), []);

	const hasOpenRequest = args.openRequest.has;

	useEffect(() => {
		if (!hasOpenRequest) return;

		const { openRequest, canApplyRequestedScope, onApplyScope } = argsRef.current;
		if (openRequest.scope && canApplyRequestedScope) onApplyScope(openRequest.scope);

		setOpen(true);
		openRequest.clear();
	}, [hasOpenRequest]);

	return { open, setOpen, toggle };
};
