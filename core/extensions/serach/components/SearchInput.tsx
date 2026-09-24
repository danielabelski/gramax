import Input from "@components/Atoms/Input";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { useSearch } from "@ext/serach/components/SearchContext";
import { useSearchQueryInputRef } from "@ext/serach/components/SearchKeyboard";
import { WithTooltip } from "@ext/serach/components/WithTooltip";
import { Button } from "@ui-kit/Button";
import { Icon } from "@ui-kit/Icon";

export const SearchInput = () => {
	const state = useSearch();
	const { ai, query, clear } = state;
	const inputRef = useSearchQueryInputRef();

	const canClear = Boolean(query.value);

	return (
		<div className="px-4 py-3.5 pr-2 flex gap-2 items-center h-12">
			<div className="cursor-auto">
				<Icon icon={"search"} size="lg" />
			</div>
			<Input
				className="flex-1 min-w-0"
				data-qa={t("search.placeholder")}
				onChange={(e) => {
					query.set(e.target.value);
				}}
				placeholder={t("search.placeholder")}
				ref={inputRef}
				type="text"
				value={query.value}
			/>
			<div className="">
				{canClear && (
					<SearchClearButton
						onClick={() => {
							clear();
							inputRef.current?.focus();
						}}
					/>
				)}
			</div>
			{ai.available && <SearchAiButton className="-ml-1" enabled={state.aiEnabled} onClick={ai.toggle} />}
		</div>
	);
};

type SearchAiButtonProps = {
	enabled: boolean;
	onClick: () => void;
	className?: string;
};

const SearchAiButton = (props: SearchAiButtonProps) => {
	const { enabled, onClick, className } = props;
	return (
		<WithTooltip tooltip={t("search.ai")}>
			<Button className={cn("h-8 w-8 p-0.5", className)} onClick={onClick} variant="ghost">
				<Icon className={cn(enabled && "fill-current")} color="#6D28D9" icon="sparkles" size="md" />
			</Button>
		</WithTooltip>
	);
};

type SearchClearButtonProps = {
	onClick: () => void;
};

const SearchClearButton = (props: SearchClearButtonProps) => {
	const { onClick } = props;
	return (
		<WithTooltip tooltip={t("clear")}>
			<Button className="h-8 w-8 p-0.5" onClick={onClick} variant="link">
				<Icon icon="x" size="md" />
			</Button>
		</WithTooltip>
	);
};
