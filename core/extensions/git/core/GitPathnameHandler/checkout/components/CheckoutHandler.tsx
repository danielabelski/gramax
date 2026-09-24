import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import SmallFence from "@components/Labels/SmallFence";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import t from "@ext/localization/locale/translate";
import { executePluginGuardedAction } from "@plugins/logic/executePluginGuardedAction";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogIcon,
	AlertDialogTitle,
} from "@ui-kit/AlertDialog";
import { Loader } from "@ui-kit/Loader";
import { toast } from "@ui-kit/Toast";
import { useState } from "react";

const BranchElement = ({ branchName }: { branchName: string }) => (
	<div style={{ display: "inline-flex" }} title={branchName}>
		<SmallFence fixWidth overflow="hidden" value={branchName} />
	</div>
);

const CheckoutHandler = ({
	currentBranchName,
	branchToCheckout,
	catalogName,
}: {
	currentBranchName: string;
	branchToCheckout: string;
	catalogName: string;
}) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const [isOpen, setIsOpen] = useState(true);
	const [checkoutProcess, setCheckoutProcess] = useState(false);

	const onCancel = () => {
		ModalToOpenService.resetValue();
		setIsOpen(false);
	};

	const onOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) ModalToOpenService.resetValue();
	};

	const onActionButtonClick = async () => {
		setCheckoutProcess(true);
		const checkout = await executePluginGuardedAction(
			"git:branch:before-checkout",
			{ catalogName, currentBranch: currentBranchName, targetBranch: branchToCheckout },
			() => FetchService.fetch(apiUrlCreator.getVersionControlCheckoutBranchUrl(branchToCheckout)),
		);
		if (checkout.allowed === false) {
			if (checkout.reason === "error") toast(t("app.error.something-went-wrong"), { status: "error" });
			setCheckoutProcess(false);
			return;
		}

		const res = checkout.result;
		setCheckoutProcess(false);

		if (!res.ok) {
			onCancel();
			return;
		}
		setIsOpen(false);

		await BranchUpdaterService.updateBranch(apiUrlCreator);
		await ArticleUpdaterService.update(apiUrlCreator);
	};

	return (
		<AlertDialog onOpenChange={onOpenChange} open={isOpen}>
			<AlertDialogContent status="warning">
				<AlertDialogHeader>
					<AlertDialogIcon icon="alert-circle" />
					<AlertDialogTitle>{t("git.checkout.change-branch")}?</AlertDialogTitle>
					<AlertDialogDescription className="article !bg-transparent">
						{checkoutProcess ? (
							<Loader size="lg" />
						) : (
							<>
								<p>{t("leads-to-the-branch")}</p>
								<p>{t("git.checkout.pathname-desc")}</p>
								<p>
									{t("git.checkout.change-branch")} <BranchElement branchName={currentBranchName} />{" "}
									{t("to-branch").toLowerCase()} <BranchElement branchName={branchToCheckout} />{" "}
									{t("and-sync-catalog").toLowerCase()}
								</p>
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{!checkoutProcess && (
					<AlertDialogFooter>
						<AlertDialogCancel onClick={onCancel} variant="outline">
							{t("cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={onActionButtonClick} variant="primary">
							{t("change-and-sync")}
						</AlertDialogAction>
					</AlertDialogFooter>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
};

export default CheckoutHandler;
