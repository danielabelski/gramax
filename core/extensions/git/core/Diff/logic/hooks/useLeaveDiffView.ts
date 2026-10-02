import { useRouter } from "@core/Api/useRouter";
import { useCallback } from "react";

export const useLeaveDiffView = () => {
	const router = useRouter();

	return useCallback(() => {
		if (router.query?.diff !== "1") return;
		router.pushQuery({ ...router.query, diff: undefined, oldScope: undefined, scope: undefined });
	}, [router]);
};
