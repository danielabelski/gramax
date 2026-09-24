import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { useReviewAuthors } from "@ext/review/logic/hooks/useReviewAuthors";
import { Checkbox, type CheckedState } from "@ui-kit/Checkbox";
import { Icon } from "@ui-kit/Icon";
import { PopoverInput } from "@ui-kit/Input";
import { Label } from "@ui-kit/Label";
import { MenuItem } from "@ui-kit/MenuItem";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Skeleton } from "@ui-kit/Skeleton";
import { type HTMLAttributes, useCallback, useMemo, useState } from "react";

interface ReviewAuthorsFilterProps {
	selectedEmails: string[] | null;
	onChange: (emails: string[]) => void;
}

interface FilterItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	checked?: CheckedState;
	name: string;
}

interface CustomFilterItemProps extends HTMLAttributes<HTMLDivElement> {
	checked: CheckedState;
}

const CustomFilterItem = ({ checked, className, children, ...props }: CustomFilterItemProps) => {
	return (
		<MenuItem
			className={cn("!bg-transparent hover:!bg-secondary-bg-hover focus:!bg-secondary-bg-hover", className)}
			{...props}
		>
			<Checkbox checked={checked} />
			<span className="font-normal text-sm">{children}</span>
		</MenuItem>
	);
};

const FilterItem = ({ checked, className, name, ...props }: FilterItemProps) => {
	return (
		<MenuItem
			className={cn("!bg-transparent hover:!bg-secondary-bg-hover focus:!bg-secondary-bg-hover", className)}
			{...props}
		>
			<Checkbox checked={checked} />
			<span className="font-normal text-sm">{name}</span>
		</MenuItem>
	);
};

export const ReviewAuthorsFilter = ({ selectedEmails, onChange }: ReviewAuthorsFilterProps) => {
	const { authors, isLoading } = useReviewAuthors();
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return q.length > 0
			? authors.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
			: authors;
	}, [authors, search]);

	const toggleAuthor = useCallback(
		(email: string) => {
			const current = selectedEmails ?? authors.map((a) => a.email);
			const isCurrentlySelected = current.includes(email);
			const next = isCurrentlySelected ? current.filter((e) => e !== email) : [...current, email];
			onChange(next.length === authors.length ? null : next);
		},
		[selectedEmails, authors, onChange],
	);

	const allSelected = selectedEmails === null ? true : selectedEmails.length === 0 ? false : "indeterminate";

	const handleSelectAll = useCallback(() => {
		onChange(selectedEmails !== null ? null : []);
	}, [onChange, selectedEmails]);

	return (
		<div className="space-y-1.5">
			<div>
				<Label className="text-xs text-muted ml-2">{t("editor.modes.filters.authors.title")}</Label>
				<PopoverInput
					className="h-8 text-sm"
					onChange={(value) => setSearch(value)}
					placeholder={t("editor.modes.filters.authors.placeholder")}
					startIcon={<Icon className="text-muted" icon="search" />}
					value={search}
				/>
			</div>
			<ScrollShadowContainer className="max-h-48 space-y-0.5">
				<CustomFilterItem checked={allSelected} className="!text-muted" onClick={handleSelectAll}>
					({t("select-all").toLowerCase()})
				</CustomFilterItem>

				{isLoading ? (
					<>
						<Skeleton className="h-8 w-full rounded-md" />
						<Skeleton className="h-8 w-full rounded-md" />
					</>
				) : (
					filtered.map((author) => {
						const isSelected = selectedEmails === null || selectedEmails.includes(author.email);
						return (
							<FilterItem
								checked={isSelected}
								className="text-primary-fg"
								key={author.email}
								name={author.name}
								onClick={() => toggleAuthor(author.email)}
							/>
						);
					})
				)}
			</ScrollShadowContainer>
		</div>
	);
};
