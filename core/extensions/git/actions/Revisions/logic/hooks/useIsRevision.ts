import { useRouter } from "@core/Api/useRouter";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import getCommitOidFromPathname from "@ext/git/actions/Revisions/logic/utils/getCommitOidFromPathname";
import { useMemo } from "react";

export const useIsRevision = () => {
	const router = useRouter();
	const { isNext, isStatic, isStaticCli } = usePlatform();

	const hasCommit = useMemo(
		() => getCommitOidFromPathname(router.query?.scope) || getCommitOidFromPathname(router.path),
		[router.path, router.query?.scope],
	);

	return !isNext && !isStatic && !isStaticCli && !!hasCommit;
};
