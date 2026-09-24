import { DialogErrorHeader } from "@ext/errorHandlers/client/components/DialogErrorHeader";
import t from "@ext/localization/locale/translate";
import { DialogBody, DialogFooterTemplate } from "@ui-kit/Dialog";
import type { GetErrorComponentProps } from "../../../../../errorHandlers/logic/GetErrorComponent";

const CheckoutConflictErrorComponent = ({ onCancelClick, error }: GetErrorComponentProps) => {
	return (
		<>
			<DialogErrorHeader error={error} title={t("git.checkout.error.conflict")} />
			<DialogBody>
				<div className="flex flex-col gap-4">
					<p>{t("git.checkout.error.conflict-diagnosis")}</p>
					<p>{t("git.checkout.error.conflict-recipe")}</p>
				</div>
			</DialogBody>
			<DialogFooterTemplate primaryButton={t("close")} primaryButtonProps={{ onClick: onCancelClick }} />
		</>
	);
};

export default CheckoutConflictErrorComponent;
