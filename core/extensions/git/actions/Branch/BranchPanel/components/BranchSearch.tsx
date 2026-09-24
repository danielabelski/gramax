import t from "@ext/localization/locale/translate";
import { Icon } from "@ui-kit/Icon";
import { PopoverInput } from "@ui-kit/Input";

type BranchSearchProps = {
	value: string;
	onChange: (value: string) => void;
};

export const BranchSearch = ({ value, onChange }: BranchSearchProps) => (
	<PopoverInput
		data-qa="qa-branch-search"
		onChange={(newValue) => onChange(newValue ?? "")}
		placeholder={`${t("find-branch")}...`}
		startIcon={<Icon className="h-4 w-4 text-muted" icon="search" />}
		value={value}
	/>
);
