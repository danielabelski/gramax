import { DialogDescription, DialogTitle } from "@ui-kit/Dialog";

interface SectionHeaderProps {
	title: string;
	description?: string;
}

const SectionHeader = ({ title, description }: SectionHeaderProps) => (
	<div className="flex flex-col gap-px lg:gap-1.5">
		<DialogTitle>{title}</DialogTitle>
		{description && <DialogDescription>{description}</DialogDescription>}
	</div>
);

export default SectionHeader;
