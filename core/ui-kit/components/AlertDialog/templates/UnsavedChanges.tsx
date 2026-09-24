import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPrimitiveAction,
	AlertDialogPrimitiveCancel,
	AlertDialogTitle,
} from "@ui-kit/AlertDialog";
import { Button } from "@ui-kit/Button";
import type { ReactNode } from "react";

export type UnsavedChangesProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDiscard: () => void;

	title: ReactNode;
	description: ReactNode;
	discardText: string;
	keepEditingText: string;
};

export const UnsavedChanges = (props: UnsavedChangesProps) => {
	const { open, onOpenChange, onDiscard, title, description, discardText, keepEditingText } = props;

	const handleDiscard = () => {
		onDiscard();
		onOpenChange(false);
	};

	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent
				className="focus-visible:outline-none lg:max-w-[min(360px,calc(100vw-64px))]"
				overlayType="dimmed"
			>
				<AlertDialogHeader className="lg:flex lg:flex-col lg:items-center">
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription className="lg:text-center">{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="flex-col-reverse gap-3 sm:flex-col-reverse sm:justify-center sm:space-x-0">
					<AlertDialogPrimitiveAction asChild>
						<Button onClick={handleDiscard} status="error" type="button" variant="outline">
							{discardText}
						</Button>
					</AlertDialogPrimitiveAction>
					<AlertDialogPrimitiveCancel asChild>
						<Button type="button" variant="primary">
							{keepEditingText}
						</Button>
					</AlertDialogPrimitiveCancel>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
