import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { CollapsedNavigationTrigger } from "@components/Layouts/CatalogLayout/RightNavigation/CollapsedNavigationTrigger";
import { RightNavigationButton } from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigationButton";
import { useRouter } from "@core/Api/useRouter";
import ArticlePropsService from "@core-ui/ContextServices/ArticleProps";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import AddContentLanguage from "@ext/localization/actions/AddContentLanguage";
import ContentLanguageActions from "@ext/localization/actions/ContentLanguageActions";
import Localizer from "@ext/localization/core/Localizer";
import { ContentLanguage } from "@ext/localization/core/model/Language";
import { useSetShowPreviewArticle, useShowPreviewArticle } from "@ext/localization/core/stores/LocalizationStore";
import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { Switch } from "@ui-kit/Switch";
import { useCallback, useEffect, useState } from "react";
import { useContentLanguageVisibility } from "./useContentLanguageVisibility";

interface SwitchContentLanguageProps {
	triggerVariant?: "default" | "glass";
}

const SwitchContentLanguage = ({ triggerVariant = "default" }: SwitchContentLanguageProps) => {
	const router = useRouter();
	const isReadOnly = PageDataContextService.value.conf.isReadOnly;

	const articleProps = ArticlePropsService.value;
	const { language, supportedLanguages } = useCatalogPropsStore(
		(state) => ({ language: state.data?.language, supportedLanguages: state.data?.supportedLanguages }),
		"shallow",
	);
	const currentLanguage = PageDataContextService.value.language.content || language;

	const [isLoading, setIsLoading] = useState(false);
	const isVisible = useContentLanguageVisibility();

	const showPreviewArticle = useShowPreviewArticle();
	const setShowPreviewArticle = useSetShowPreviewArticle();

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		if (isLoading) setIsLoading(false);
	}, [currentLanguage]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	const switchLanguage = useCallback(
		(code: ContentLanguage) => {
			if (code === currentLanguage) return;

			if (isReadOnly) {
				router.pushPath(
					Localizer.addPath({
						current: currentLanguage,
						logicPath: articleProps.logicPath,
						target: code,
						primaryLanguage: language,
					}),
				);
				return;
			}

			router.pushPath(
				Localizer.addPathname({
					current: currentLanguage,
					logicPath: articleProps.logicPath,
					pathname: articleProps.pathname,
					target: code,
					primaryLanguage: language,
				}),
			);
		},
		[currentLanguage, isReadOnly, language, router, articleProps],
	);

	const onSwitchPreviewArticle = useCallback(
		(event: Event) => {
			if (typeof window === "undefined") return;
			event.preventDefault();

			setShowPreviewArticle(!showPreviewArticle);
		},
		[setShowPreviewArticle, showPreviewArticle],
	);

	if (!isVisible) return null;

	return (
		<ComponentVariantProvider variant="glass">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					{triggerVariant === "glass" ? (
						<CollapsedNavigationTrigger
							data-qa="switch-content-language"
							disabled={isLoading}
							icon="languages"
							label={t(`language.${ContentLanguage[currentLanguage]}`)}
						/>
					) : (
						<RightNavigationButton
							asTrigger
							data-qa="switch-content-language"
							disabled={isLoading}
							isLoading={isLoading}
							startIcon="languages"
							trailingIcon="chevron-down"
						>
							{t(`language.${ContentLanguage[currentLanguage]}`)}
						</RightNavigationButton>
					)}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					{!isReadOnly && (
						<>
							<AddContentLanguage onChange={switchLanguage} setIsLoading={setIsLoading} />
							<DropdownMenuItem onSelect={onSwitchPreviewArticle}>
								<Icon icon={"columns-2" as IconCode} />
								{t("multilang.preview-article")}
								<Switch checked={showPreviewArticle} className="pointer-events-none" size="sm" />
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuRadioGroup
						indicatorIconPosition="start"
						onValueChange={switchLanguage}
						value={currentLanguage}
					>
						{Object.values(supportedLanguages).map((code) => {
							const showActions = !isReadOnly && language !== code;

							return (
								<DropdownMenuRadioItem key={code} value={code}>
									<div className="flex items-center justify-between w-full">
										{t(`language.${ContentLanguage[code]}`)}
										{showActions && (
											<ContentLanguageActions
												canSwitch={code !== currentLanguage}
												setIsLoading={setIsLoading}
												targetCode={code}
											/>
										)}
									</div>
								</DropdownMenuRadioItem>
							);
						})}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ComponentVariantProvider>
	);
};

export default SwitchContentLanguage;
