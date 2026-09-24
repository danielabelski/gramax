import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { Label } from "@ui-kit/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-kit/Select";
import { useCallback } from "react";

type InboxAuthorSelectProps = {
	authors: string[];
	selectedAuthor: string;
	onBeforeChange: () => Promise<boolean>;
	onChange: (author: string) => Promise<void>;
};

export const InboxAuthorSelect = ({ authors, selectedAuthor, onBeforeChange, onChange }: InboxAuthorSelectProps) => {
	const handleChange = useCallback(
		async (author: string) => {
			if (await onBeforeChange()) await onChange(author);
		},
		[onBeforeChange, onChange],
	);

	return (
		<div className="px-4 pb-3">
			<Label className="mb-2 block text-sm font-medium text-muted h-4" htmlFor="inbox-author">
				{t("inbox.author")}
			</Label>
			<Select onValueChange={(value) => void handleChange(value)} value={selectedAuthor}>
				<SelectTrigger
					className={cn(
						"w-full justify-start !shadow-none hover:!shadow-none active:!shadow-none focus:!shadow-none focus-visible:!shadow-none",
						"invalid:!shadow-none invalid:hover:!shadow-none invalid:focus:!shadow-none",
						"aria-[invalid=true]:!shadow-none aria-[invalid=true]:hover:!shadow-none aria-[invalid=true]:focus:!shadow-none",
						"read-only:!shadow-none disabled:!shadow-none",
					)}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{authors.map((author) => (
						<SelectItem key={author} value={author}>
							{author}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
