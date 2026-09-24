import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { cn } from "@core-ui/utils/cn";
import { BRANCH_PANEL_ID } from "@ext/git/actions/Branch/BranchPanel/constants";
import SyncService from "@ext/git/actions/Sync/logic/SyncService";
import t from "@ext/localization/locale/translate";
import useIsSourceDataValid from "@ext/storage/components/useIsSourceDataValid";
import { Button, LoadingButtonTemplate } from "@ui-kit/Button";
import { Counter } from "@ui-kit/Counter";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { PopoverInput } from "@ui-kit/Input";
import { AutogrowTextarea } from "@ui-kit/Textarea";
import { Suspense } from "react";
import { ConnectStorageButton } from "./ConnectStorageButton";

export type PublishFooterProps = {
	message: string;
	fileCount: number;
	isPublishing: boolean;
	isInputDisabled: boolean;
	isPublishDisabled: boolean;
	isProtectedBranch: boolean;
	hasGitConflicts: boolean;
	onMessageChange: (message: string) => void;
	onPublish: () => void;
};

export const PublishFooter = ({
	message,
	fileCount,
	isPublishing,
	isInputDisabled,
	isPublishDisabled,
	isProtectedBranch,
	hasGitConflicts,
	onMessageChange,
	onPublish,
}: PublishFooterProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const canPush = useIsSourceDataValid();
	const { open: openBranchPanel } = usePanelToggle(BRANCH_PANEL_ID);

	const action = () => {
		if (!canPush) return <ConnectStorageButton />;

		if (isProtectedBranch)
			return (
				<Button className="w-full shadow-none" onClick={() => openBranchPanel()} startIcon="plus">
					{t("add-new-branch")}
				</Button>
			);

		if (hasGitConflicts)
			return (
				<Button className="w-full shadow-none" onClick={() => void SyncService.sync(apiUrlCreator, true)}>
					{t("git.publish.error.resolve-conflicts")}
				</Button>
			);

		if (isPublishing) return <LoadingButtonTemplate text={`${t("git.publish.to-publish")}...`} />;

		return (
			<Button
				className="w-full shadow-none"
				data-testid="publish-submit"
				disabled={isPublishDisabled}
				onClick={onPublish}
			>
				{t("git.publish.to-publish")}
				{fileCount > 0 && (
					<Counter className="rounded-full" size="sm" variant="secondary">
						{fileCount}
					</Counter>
				)}
			</Button>
		);
	};

	return (
		<div className="flex shrink-0 flex-col gap-2 px-1 pb-1 pt-4">
			<Suspense
				fallback={
					<PopoverInput
						disabled={isInputDisabled}
						onChange={(value) => onMessageChange(value)}
						placeholder={`${t("commit-message")}...`}
						value={message ?? ""}
					/>
				}
			>
				<AutogrowTextarea
					className={cn(
						"!shadow-none hover:!shadow-none active:!shadow-none focus:!shadow-none focus-visible:!shadow-none",
						"invalid:!shadow-none invalid:hover:!shadow-none invalid:focus:!shadow-none",
						"aria-[invalid=true]:!shadow-none aria-[invalid=true]:hover:!shadow-none aria-[invalid=true]:focus:!shadow-none",
						"read-only:!shadow-none disabled:!shadow-none",
					)}
					disabled={isInputDisabled}
					maxRows={3}
					minRows={1}
					onChange={(event) => onMessageChange(event.target.value)}
					placeholder={`${t("commit-message")}...`}
					value={message ?? ""}
				/>
			</Suspense>
			{action()}
		</div>
	);
};
