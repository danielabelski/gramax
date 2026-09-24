import { Spinner } from "@ext/enterprise/components/admin/ui-kit/Spinner";
import { OFERTA_LINK } from "@ext/enterprise-cloud/logic/billing/OfertaLink";
import t from "@ext/localization/locale/translate";
import { Button, type ButtonProps, LoadingButtonTemplate } from "@ui-kit/Button";
import { Dialog, DialogBody, DialogContent } from "@ui-kit/Dialog";
import { FormHeader } from "@ui-kit/Form";
import type { ReactNode } from "react";

interface PayModalLayoutProps {
	open: boolean;
	title: string;
	error: string | null;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}

export const PayModalLayout = ({ open, title, error, onOpenChange, children }: PayModalLayoutProps) => (
	<Dialog onOpenChange={onOpenChange} open={open}>
		<DialogContent data-modal-root>
			<FormHeader icon="credit-card" title={title} />
			<DialogBody>
				{error && <div className="mb-3 text-destructive text-sm">{error}</div>}
				<div className="flex flex-col gap-4">{children}</div>
			</DialogBody>
		</DialogContent>
	</Dialog>
);

export const PaymentInfoLoader = () => (
	<div className="flex items-center justify-center w-full">
		<div className="flex flex-col items-center gap-2">
			<Spinner size="medium" />
		</div>
	</div>
);

export const ButtonWithLoadingState = ({
	disabled,
	onClick,
	text,
	loadingText,
	variant,
	isLoading,
}: {
	disabled: boolean;
	onClick: () => void;
	text: string;
	loadingText?: string;
	variant: ButtonProps["variant"];
	isLoading: boolean;
}) => {
	return isLoading ? (
		<LoadingButtonTemplate className="w-full" text={loadingText ?? text} variant={variant} />
	) : (
		<Button className="w-full" disabled={disabled} onClick={onClick} variant={variant}>
			{text}
		</Button>
	);
};

export const OfferAcceptanceNotice = () => (
	<span className="text-muted-foreground text-sm">
		{t("enterprise-cloud.org-settings.subscription.payment.offer-acceptance-prefix")}{" "}
		<a className="underline" href={OFERTA_LINK} rel="noreferrer" target="_blank">
			{t("enterprise-cloud.org-settings.subscription.payment.offer")}
		</a>
	</span>
);

interface RowProps {
	label: string;
	value: string;
	bold?: boolean;
}

export const Row = ({ label, value, bold }: RowProps) => (
	<div className={`flex items-center justify-between text-sm${bold ? " font-semibold" : ""}`}>
		<span>{label}</span>
		<span>{value}</span>
	</div>
);
