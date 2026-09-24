import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { CancelButton } from "@ext/enterprise/components/admin/ui-kit/CancelButton";
import { CloseConfirmationDialog } from "@ext/enterprise/components/admin/ui-kit/CloseConfirmationDialog";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { SaveButton } from "@ext/enterprise/components/admin/ui-kit/SaveButton";
import { SheetComponent } from "@ext/enterprise/components/admin/ui-kit/SheetComponent";
import t from "@ext/localization/locale/translate";
import { SwitchField } from "@ui-kit/Switch";
import { useCallback, useEffect, useState } from "react";
import { WithTooltip } from "../../../../../enterprise/components/admin/ui-kit/WithTooltip";
import { useAnyTargetEditorSheet } from "../../../../../enterpriseCommon/hooks/useEditorSheet";
import type { AccessChange, GesCloudMember } from "../members/types/GesCloudUsersComponentTypes";

interface EditMemberModalProps {
	open: boolean;
	onClose: () => void;
	user?: GesCloudMember;
	onApply: (changes: AccessChange[]) => Promise<void>;
}

interface UseEditMemberFormArgs {
	user?: GesCloudMember | null;
	onApply: (changes: AccessChange[]) => Promise<void>;
	onClose: () => void;
}

interface BuildUserChangesInput {
	email: string;
	isAdmin: boolean;
	wasAdmin: boolean | undefined;
}

const buildUserChanges = (input: BuildUserChangesInput): AccessChange[] => {
	const { email, isAdmin, wasAdmin } = input;
	const changes: AccessChange[] = [];

	if (Boolean(isAdmin) !== Boolean(wasAdmin)) {
		changes.push({ kind: "setUserAdmin", userId: email, setAdmin: isAdmin });
	}

	return changes;
};

const useEditMemberForm = ({ user, onApply, onClose }: UseEditMemberFormArgs) => {
	const email = user?.email ?? "";
	const [isAdmin, setIsAdmin] = useState(Boolean(user?.isAdmin));

	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;

	useEffect(() => {
		if (user) setIsAdmin(Boolean(user.isAdmin));
	}, [user]);

	const handleSetIsAdmin = useCallback(
		(val: boolean) => {
			if (user && !user.isOwner) setIsAdmin(val);
		},
		[user],
	);

	const wasAdmin = Boolean(user?.isAdmin);

	const buildChanges = useCallback(() => {
		return buildUserChanges({
			email,
			isAdmin,
			wasAdmin,
		});
	}, [isAdmin, wasAdmin, email]);

	const { saving, saveError, showUnsaved, setShowUnsaved, requestClose, submit, close } = useAnyTargetEditorSheet({
		buildChanges,
		apply: onApply,
		onClose,
		backendUrl: gesCloudUrl,
	});

	return {
		data: {
			email,
			isAdmin,
			setIsAdmin: handleSetIsAdmin,
			isOwner: user?.isOwner,
			type: user?.type,
		},
		form: {
			submit,
			close,
			saving,
			saveError,
			showUnsaved,
			setShowUnsaved,
			requestClose,
		},
	};
};

export const EditMemberModal = (props: EditMemberModalProps) => {
	const { open } = props;
	const { data, form } = useEditMemberForm(props);

	return (
		<>
			<SheetComponent
				cancelButton={
					<>
						<CancelButton
							onClick={(e) => {
								e.preventDefault();
								form.requestClose();
							}}
						/>
					</>
				}
				confirmButton={
					<SaveButton
						isSaving={form.saving}
						onClick={async (e) => {
							e.preventDefault();
							await form.submit();
						}}
					/>
				}
				isOpen={open}
				onOpenChange={(next) => !next && form.requestClose()}
				sheetContent={
					<div className="flex flex-col gap-6">
						<FloatingAlert message={form.saveError.message} show={Boolean(form.saveError.isShown)} />

						<div className="flex flex-col gap-4">
							<WithTooltip
								tooltip={
									data.isOwner
										? t("enterprise-cloud.org-settings.users.admin.owner-cant-be-admin-hint")
										: data.type === "invite"
											? t(
													"enterprise-cloud.org-settings.users.admin.cant-set-invite-as-admin-hint",
												)
											: undefined
								}
							>
								<SwitchField
									alignment="right"
									checked={data.isAdmin}
									className="justify-between"
									description={t("enterprise-cloud.org-settings.users.admin.admin-hint")}
									disabled={data.isOwner || data.type === "invite"}
									label={t("enterprise-cloud.org-settings.users.roles.admin")}
									onCheckedChange={(c) => data.setIsAdmin(Boolean(c))}
									outline
								/>
							</WithTooltip>
						</div>
					</div>
				}
				title={
					<>
						{t("enterprise.admin.users.editing")}{" "}
						<span className="text-muted whitespace-nowrap">{data.email}</span>
					</>
				}
			/>

			<CloseConfirmationDialog
				isOpen={form.showUnsaved}
				onClose={form.close}
				onOpenChange={form.setShowUnsaved}
			/>
		</>
	);
};
