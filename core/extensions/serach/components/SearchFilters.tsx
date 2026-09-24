import { SearchFilteredProperties } from "@ext/serach/components/propertyFilter/SearchFilteredProperties";
import { SearchPropertyFilter } from "@ext/serach/components/propertyFilter/SearchPropertyFilter";
import { useSearch } from "@ext/serach/components/SearchContext";
import { SearchResourceFilterDropdown } from "@ext/serach/components/SearchResourceFilterDropdown";
import { SearchScopeDropdown } from "@ext/serach/components/SearchScopeDropdown";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";

export const SearchFilters = () => {
	const state = useSearch();
	const { scope } = state;

	if (!scope.available.length && state.aiEnabled === true) return null;

	return (
		<ScrollShadowContainer className="max-h-[8rem]">
			<div className="px-4 py-3 flex gap-1 items-center flex-wrap">
				{scope.available.length > 0 && (
					<SearchScopeDropdown
						isCategory={scope.isCategory}
						scopes={scope.available}
						setValue={scope.set}
						value={scope.value}
					/>
				)}
				{state.aiEnabled === false && (
					<>
						<SearchResourceFilterDropdown
							setValue={state.resourceFilter.set}
							value={state.resourceFilter.value}
						/>
						{state.property && (
							<>
								<SearchFilteredProperties controllers={state.property.controllers} />
								<SearchPropertyFilter
									controllers={state.property.controllers}
									hasSelection={state.property.selected.length > 0}
									onResetAll={state.property.clearFilteredProperties}
								/>
							</>
						)}
					</>
				)}
			</div>
		</ScrollShadowContainer>
	);
};
