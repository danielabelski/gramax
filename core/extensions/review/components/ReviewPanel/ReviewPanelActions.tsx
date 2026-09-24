import { ReviewFilters } from "@ext/review/components/Filters/ReviewFilters";
import { ReviewOptions } from "@ext/review/components/ReviewOptions";
import { ReviewSorting } from "@ext/review/components/Sorting/ReviewSorting";
import { ComponentVariantProvider } from "@ui-kit/Providers";

export const ReviewPanelActions = () => {
	return (
		<ComponentVariantProvider variant="glass">
			<ReviewSorting />
			<ReviewFilters />
			<ReviewOptions />
		</ComponentVariantProvider>
	);
};
