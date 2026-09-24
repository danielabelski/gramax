import type { Section } from "@core/SitePresenter/SitePresenter";
import ArticleTooltipService from "@core-ui/ContextServices/ArticleTooltip";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { useSearchKeyboard } from "@ext/serach/components/hooks/useSearchKeyboard";
import { useSearchState } from "@ext/serach/components/hooks/useSearchState";
import { SearchKeyboardProvider } from "@ext/serach/components/SearchKeyboard";
import { SearchRoot } from "@ext/serach/components/SearchRoot";
import { IconButton } from "@ui-kit/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@ui-kit/Dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type ReactElement, useState } from "react";

export type SearchProps = {
	isHomePage?: boolean;
	section?: Section;
	itemLinks?: ItemLink[];
	trigger?: ReactElement;
};

export const Search = (props: SearchProps) => {
	const { isHomePage, section, itemLinks, trigger } = props;
	const state = useSearchState({ isHomePage, section, itemLinks });
	const keyboard = useSearchKeyboard(state);
	const [dialogContent, setDialogContent] = useState<HTMLDivElement>(null);

	return (
		<Dialog onOpenChange={state.dialog.setOpen} open={state.dialog.open}>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : (
				<Tooltip>
					<TooltipContent>
						<p>{t("search.name")}</p>
					</TooltipContent>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<DialogTrigger asChild>
								<IconButton
									aria-label={t("search.name")}
									className={cn("p-2", !isHomePage && "p-0 size-5")}
									icon="search"
									iconClassName="size-5 stroke-[1.6]"
									size="lg"
									type="button"
									variant={isHomePage ? "ghost" : "link"}
								/>
							</DialogTrigger>
						</span>
					</TooltipTrigger>
				</Tooltip>
			)}

			<DialogContent
				aria-describedby={undefined}
				className={cn(
					"top-[10%] lg:top-[10%] h-auto w-[calc(100vw-2rem)] max-w-[840px] lg:max-w-[840px]",
					"max-h-[85%] lg:max-h-[85%] translate-y-0 lg:translate-y-0 overflow-visible",
					"focus-visible:outline-none font-sans [&_ol]:list-none",
				)}
				onKeyDown={keyboard.onKeyDown}
				overlayType="dimmed"
				ref={setDialogContent}
				showCloseButton={false}
			>
				<DialogHeader className="sr-only absolute !p-0">
					<DialogTitle>{t("search.name")}</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col overflow-hidden rounded-xl">
					<SearchKeyboardProvider keyboard={keyboard}>
						<ArticleTooltipService.Provider container={dialogContent}>
							<SearchRoot state={state} />
						</ArticleTooltipService.Provider>
					</SearchKeyboardProvider>
				</div>
			</DialogContent>
		</Dialog>
	);
};
