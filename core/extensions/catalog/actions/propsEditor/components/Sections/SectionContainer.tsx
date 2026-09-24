import { FormStack } from "@ui-kit/Form";

interface SectionContainerProps {
	children: React.ReactNode;
	stackClassName?: string;
	/** Tab title block — sits above the fields, spaced by the container's own gap. */
	header?: React.ReactNode;
}

export const SectionContainer = ({ children, stackClassName, header }: SectionContainerProps) => {
	return (
		<div className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto px-5 pt-5">
			{header}
			<FormStack className={stackClassName}>{children}</FormStack>
		</div>
	);
};
