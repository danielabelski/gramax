import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import { useCallback, useMemo, useState } from "react";

export const usePayModalState = (onClose: () => void) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [open, setOpen] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const idempotenceKey = useMemo(() => globalThis.crypto.randomUUID(), []);

	const onOpenChangeHandler = useCallback(
		(value: boolean) => {
			setOpen(value);
			if (!value) onClose();
		},
		[onClose],
	);

	return {
		gesCloudApi,
		open,
		error,
		setError,
		idempotenceKey,
		onOpenChangeHandler,
	};
};
