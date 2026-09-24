import { useRouter } from "@core/Api/useRouter";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { LinkHoverTooltipManager } from "@ext/markdown/elements/link/edit/logic/LinkHoverTooltipManager";
import { createContext, useContext, useEffect, useRef } from "react";

interface ArticleTooltipProviderProps {
	children: JSX.Element;
	container?: HTMLElement;
}

interface ArticleTooltipContext {
	setLink: (link: HTMLElement, resourcePath: string, hash?: string, href?: string) => void;
	removeLink: (resourcePath: string) => void;
}

export const ArticleTooltip = createContext<ArticleTooltipContext>({
	setLink: () => {},
	removeLink: () => {},
});

export interface UseArticleTooltipOptions {
	withMarkData?: boolean;
	container?: HTMLElement;
}

export const useArticleTooltip = ({ withMarkData = false, container }: UseArticleTooltipOptions = {}) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const pageDataContext = PageDataContextService.value;
	const tooltipManager = useRef<LinkHoverTooltipManager>(null);
	const router = useRouter();
	const environment = usePlatform().environment;

	// biome-ignore lint/correctness/useExhaustiveDependencies: recreate only when container changes
	useEffect(() => {
		if (typeof document === "undefined") return;

		if (tooltipManager.current !== null) {
			tooltipManager.current.destroyAll();
		}

		tooltipManager.current = new LinkHoverTooltipManager(
			container ?? document.body,
			pageDataContext,
			environment,
			router.basePath,
		);

		return () => {
			if (tooltipManager.current !== null) {
				tooltipManager.current.destroyAll();
				tooltipManager.current = null;
			}
		};
	}, [container]);

	const setLink = (element: HTMLElement, resourcePath: string, hash?: string, href?: string) => {
		if (typeof document === "undefined") return;

		tooltipManager.current?.createTooltip({
			linkElement: element,
			resourcePath,
			hash,
			apiUrlCreator,
			href,
			...(withMarkData
				? { markData: href ? { from: 0, to: 0, mark: { attrs: { href, hash } } } : undefined }
				: {}),
		});
	};

	const removeLink = (resourcePath: string) => {
		if (typeof document === "undefined") return;
		const tooltip = tooltipManager.current?.getTooltip(resourcePath);
		if (tooltip) tooltipManager.current?.removeTooltip(tooltip);
	};

	return { setLink, removeLink };
};

// biome-ignore lint/complexity/noStaticOnlyClass: idc
abstract class ArticleTooltipService {
	static Provider({ children, container }: ArticleTooltipProviderProps): JSX.Element {
		const { setLink, removeLink } = useArticleTooltip({ container });

		return <ArticleTooltip.Provider value={{ setLink, removeLink }}>{children}</ArticleTooltip.Provider>;
	}

	static get value(): ArticleTooltipContext {
		return useContext(ArticleTooltip);
	}
}

export default ArticleTooltipService;
