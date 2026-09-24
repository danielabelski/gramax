import LucideIconComponent from "@components/Atoms/Icon/LucideIcon";
import t from "@ext/localization/locale/translate";
import { useSearch } from "@ext/serach/components/SearchContext";
import { SearchFilters } from "@ext/serach/components/SearchFilters";
import { SearchInput } from "@ext/serach/components/SearchInput";
import { Divider } from "@ui-kit/Divider";
import { ProgressBlockTemplate } from "@ui-kit/Progress";
import type { LucideIcon } from "lucide-react";

export const SearchHeader = () => {
	const state = useSearch();
	const { indexing } = state;

	return (
		<div>
			<SearchInput />
			<Divider />
			<div>
				<SearchFilters />
				{indexing.inProgress && (
					<div className="px-4 pb-3 pt-1 first:pt-3">
						<SearchIndexingProgress progress={indexing.progress} />
					</div>
				)}
			</div>
		</div>
	);
};

export type SearchIndexingProgressProps = {
	progress: number;
};

export const SearchIndexingProgress = (props: SearchIndexingProgressProps) => {
	const { progress } = props;
	return (
		<ProgressBlockTemplate
			description={`${(progress * 100).toFixed(0)}%`}
			icon={LucideIconComponent("loader") as LucideIcon}
			max={1}
			size="sm"
			title={t("search.indexing-info")}
			value={progress}
		/>
	);
};
