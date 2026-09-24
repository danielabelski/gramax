import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { AlertDialogContent } from "@ui-kit/AlertDialog/AlertDialogContent";
import { AlertDialogIcon } from "@ui-kit/AlertDialog/AlertDialogIcon";
import { Button, LoadingButtonTemplate } from "@ui-kit/Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ui-kit/Collapsible";
import {
	AlertDialog,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "ics-ui-kit/components/alert-dialog";
import { type ReactNode, useState } from "react";

export type AlertProgressConfirmProps = {
	open: boolean;
	/** While true the dialog refuses to close and the confirm button shows its loading template. */
	running: boolean;

	icon: IconCode;
	title: ReactNode;
	/** Rows of the body. A fragment's children each become a row of the same rhythm. */
	description: ReactNode;

	/** Contents of the disclosure under the body; without it no disclosure is rendered. */
	details?: ReactNode;
	detailsText?: string;

	/** A closing row, kept under the disclosure. */
	note?: ReactNode;

	confirmText: string;
	cancelText: string;
	onConfirm: () => void;
	onCancel: () => void;
};

export const AlertProgressConfirm = (props: AlertProgressConfirmProps) => {
	const {
		open,
		running,
		icon,
		title,
		description,
		details,
		detailsText,
		note,
		confirmText,
		cancelText,
		onConfirm,
		onCancel,
	} = props;

	const [detailsOpen, setDetailsOpen] = useState(false);

	return (
		<AlertDialog
			onOpenChange={(next) => {
				if (!next && !running) onCancel();
			}}
			open={open}
		>
			<AlertDialogContent
				onEscapeKeyDown={(event) => {
					if (running) event.preventDefault();
				}}
			>
				{/* keep the lg grid layout (icon column + left-aligned text) at all widths — the default
				    switches to a centered column below lg, which breaks in narrow desktop windows.
				    `min-w-0` here and on the rows below: a grid item refuses to shrink below its widest
				    child, and an unbreakable path would otherwise push the track past the dialog. */}
				<AlertDialogHeader className="grid min-w-0 grid-cols-[0_minmax(0,1fr)] items-start gap-y-4 has-[>svg]:grid-cols-[1.5rem_minmax(0,1fr)] has-[>svg]:gap-x-4">
					<AlertDialogIcon icon={icon} />
					<AlertDialogTitle className="col-start-2 mb-0 text-left">{title}</AlertDialogTitle>
					<AlertDialogDescription asChild className="col-start-2 text-left text-primary-fg">
						<div className="flex min-w-0 flex-col gap-3">
							{description}
							{details && (
								<Collapsible onOpenChange={setDetailsOpen} open={detailsOpen}>
									<CollapsibleTrigger asChild>
										{/* `h-auto p-0` strips the button box: the trigger reads as a line of the body,
										    at the body's own size. */}
										<Button
											className="h-auto p-0 font-normal"
											endIcon={detailsOpen ? "chevron-up" : "chevron-down"}
											variant="link"
										>
											{detailsText}
										</Button>
									</CollapsibleTrigger>
									{/* The panel may carry no class that sets `display`: Radix hides it with `[hidden]`
									    alone, and any author `display` outranks that user-agent rule, so the panel would
									    stay laid out and replay its closing animation — layout goes on the wrapper. */}
									<CollapsibleContent>
										<div className="flex min-w-0 flex-col gap-2 pt-3">{details}</div>
									</CollapsibleContent>
								</Collapsible>
							)}
							{note}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				{/* The ui-kit footer only stacks below the `sm` viewport breakpoint, but the dialog can be
				    narrow while the window is wide. Labels never break mid-word: the buttons keep their
				    text on one line and wrap onto separate rows instead. */}
				<AlertDialogFooter className="min-w-0 flex-wrap gap-3 sm:justify-end sm:space-x-0">
					<Button className="whitespace-nowrap" disabled={running} onClick={onCancel} variant="outline">
						{cancelText}
					</Button>
					{running ? (
						<LoadingButtonTemplate className="whitespace-nowrap" text={confirmText} variant="primary" />
					) : (
						<Button className="whitespace-nowrap" onClick={onConfirm} variant="primary">
							{confirmText}
						</Button>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
