import Link from "@components/Atoms/Link";
import { useRouter } from "@core/Api/useRouter";
import Url from "@core-ui/ApiServices/Types/Url";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import type { ReactNode } from "react";

export const TopBarHomeLink = ({ children }: { children: ReactNode }) => {
	const router = useRouter();
	const { logo, cloudServiceUrl } = PageDataContextService.value.conf;
	const { isStatic, isStaticCli } = usePlatform();

	const showHomePageButton = (!(isStatic || isStaticCli) || cloudServiceUrl) && !logo.imageUrl;
	if (!showHomePageButton) return null;

	return (
		<Link className="home" dataQa="home-page-button" href={Url.fromRouter(router, { pathname: "/" })}>
			{children}
		</Link>
	);
};

export default TopBarHomeLink;
