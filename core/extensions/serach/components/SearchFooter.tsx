import IsMacService from "@core-ui/ContextServices/IsMac";
import t from "@ext/localization/locale/translate";
import { useSearch } from "@ext/serach/components/SearchContext";
import { Icon } from "@ui-kit/Icon";
import { Prose } from "@ui-kit/Prose";

export const SearchFooter = () => {
	const state = useSearch();
	const isMac = IsMacService.value;

	return (
		<Prose className="h-10 flex items-center justify-between px-4 py-2.5 text-xs font-normal bg-secondary-bg-hover/40 backdrop-blur-xl border-t border-secondary-border w-full">
			<span className="flex gap-1.5 items-center">
				<kbd className="text-xs h-5 inline-flex items-center leading-none gap-0.5">
					{isMac ? <Icon icon="command" size="sm" /> : "Ctrl"}
					<svg className="size-3" fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
						<path d="M7.5 1L4.5 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1" />
					</svg>
				</kbd>
				{t("search.open")}
			</span>
			<span className="flex items-center gap-4 [&>span]:flex [&>span]:gap-1.5 [&>span]:items-center">
				{state.aiEnabled === false && (
					<>
						<span>
							<kbd className="text-xs p-1 size-5 inline-flex items-center justify-center">
								<Icon icon="arrow-down" size="sm" />
							</kbd>
							<kbd className="text-xs p-1 size-5 inline-flex items-center justify-center">
								<Icon icon="arrow-up" size="sm" />
							</kbd>
							{t("to-navigate")}
						</span>
						<span>
							<kbd className="text-xs p-1 size-5 inline-flex items-center justify-center">
								<Icon icon="corner-down-left" size="sm" />
							</kbd>
							{t("open")}
						</span>
					</>
				)}
				<span>
					<kbd className="text-xs h-5 inline-flex items-center leading-none">Esc</kbd>
					{t("close")}
				</span>
			</span>
		</Prose>
	);
};
