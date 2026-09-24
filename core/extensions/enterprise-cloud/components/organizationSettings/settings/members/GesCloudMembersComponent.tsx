import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { TableToolbarTextInput } from "@ext/enterprise/components/admin/ui-kit/table/TableToolbarTextInput";
import {
	type BillingModeCode,
	type BillingPeriodCode,
	GesCloudApi,
	type GesCloudSubscription,
} from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { getCoreRowModel, getFilteredRowModel, type Row, useReactTable } from "@ui-kit/DataTable";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import ModalToOpenService from "../../../../../../ui-logic/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "../../../../../../ui-logic/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { useSheetSlot } from "../../../../../enterprise/components/admin/hooks/useSheetSlot";
import { AlertDeleteDialog } from "../../../../../enterprise/components/admin/ui-kit/AlertDeleteDialog";
import { TabInitialLoader } from "../../../../../enterprise/components/admin/ui-kit/TabInitialLoader";
import { TableComponent } from "../../../../../enterprise/components/admin/ui-kit/table/TableComponent";
import { TableInfoBlock } from "../../../../../enterprise/components/admin/ui-kit/table/TableInfoBlock";
import { TableToolbar } from "../../../../../enterprise/components/admin/ui-kit/table/TableToolbar";
import type { PurchaseSeatPayModal } from "../../../payModals/PurchaseSeatPayModal";
import { SubscriptionInactiveAlert } from "../../../SubscriptionInactiveAlert/SubscriptionInactiveAlert";
import { RefreshDataButton } from "../../components/RefreshDataButton";
import { EditMemberModal } from "../components/EditMemberModal";
import type { PayerTypeChooseModal } from "../components/PayerTypeChooseModal";
import type { TariffChooseModal } from "../components/TariffChooseModal";
import { getGesCloudUsersTableColumns } from "./config/GesCloudUsersTableConfig";
import type { AccessChange, GesCloudMember } from "./types/GesCloudUsersComponentTypes";

export type GesCloudUsersComponentProps = {
	subscription: GesCloudSubscription | null;
	refreshSubscription: () => void;
};

const GesCloudUsersComponent = ({ subscription, refreshSubscription }: GesCloudUsersComponentProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [members, setMembers] = useState<GesCloudMember[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [rowSelection, setRowSelection] = useState({});
	const [saveError, setSaveError] = useState<string | null>(null);
	const singleSlot = useSheetSlot<GesCloudMember | null>({ keyBase: "single" });

	const currentUserMail = PageDataContextService.value.user.info?.mail;
	const isCurrentUserOwner = useMemo(
		() => members.some((member) => member.type === "user" && member.isOwner && member.email === currentUserMail),
		[members, currentUserMail],
	);
	const isCurrentUserAdmin = useMemo(
		() => members.some((member) => member.type === "user" && member.isAdmin && member.email === currentUserMail),
		[members, currentUserMail],
	);

	const refreshMembers = useCallback(async () => {
		const membersData = await gesCloudApi.getMembers();
		setMembers(membersData);
	}, [gesCloudApi]);

	const refreshData = useCallback(async () => {
		try {
			setIsLoading(true);
			const [membersData] = await Promise.all([gesCloudApi.getMembers(), refreshSubscription()]);
			setMembers(membersData);
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to load members or subscription");
		} finally {
			setIsLoading(false);
		}
	}, [gesCloudApi, refreshSubscription]);

	useEffect(() => {
		void refreshData();
	}, [refreshData]);

	const maxSeats = subscription?.seatsInfo.maxSeats ?? 0;

	const columns = useMemo(() => getGesCloudUsersTableColumns(isCurrentUserOwner), [isCurrentUserOwner]);

	const table = useReactTable({
		data: members,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			rowSelection,
		},
		defaultColumn: { size: 0 },
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: delete button wont appear without this
	const selectedCount = useMemo(() => table.getFilteredSelectedRowModel().rows.length, [table, rowSelection]);

	const deleteSelected = useCallback(async () => {
		const selectedRows = table.getFilteredSelectedRowModel().rows;
		if (selectedRows.some((row) => row.original.isAdmin) && isCurrentUserAdmin) return;
		const selectedUserEmails = selectedRows.map((row) => row.original.email);

		try {
			await gesCloudApi.excludeMembers(selectedUserEmails);
			const updatedMembers = members.filter((member) => !selectedUserEmails.includes(member.email));
			setMembers(updatedMembers);
			setRowSelection({});
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to exclude members");
		}
	}, [members, table, gesCloudApi, isCurrentUserAdmin]);

	const handleInviteMember = useCallback(
		async (email: string) => {
			if (!members.some((member) => member.email === email)) {
				try {
					await gesCloudApi.inviteMember(email);
					const newMember: GesCloudMember = { email, type: "invite" };
					setMembers([...members, newMember]);
					setSaveError(null);
				} catch (error) {
					setSaveError(error instanceof Error ? error.message : "Failed to invite user");
				}
			}
		},
		[members, gesCloudApi],
	);

	const handleFilterChange = useCallback(
		(value: string | null) => {
			table.getColumn("email")?.setFilterValue(value);
		},
		[table],
	);

	const setUserAdmin = useCallback(
		async (changes: AccessChange[]) => {
			try {
				for (const change of changes)
					await gesCloudApi.setUserAdmin({ email: change.userId, setAdmin: change.setAdmin });

				await refreshMembers();
			} catch (error) {
				setSaveError(error instanceof Error ? error.message : "Failed to set admin role for user");
			}
		},
		[gesCloudApi, refreshMembers],
	);

	const openPurchaseSeatPayModal = useCallback(
		(
			newSeatsCount: number,
			billingPeriod?: BillingPeriodCode,
			billingMode: BillingModeCode = subscription?.billingMode ?? "individual",
		) => {
			if (!subscription) return;

			const paymentModalId = ModalToOpenService.addModal<ComponentProps<typeof PurchaseSeatPayModal>>(
				ModalToOpen.GesCloudPurchaseSeatPayModal,
				{
					newSeatsCount,
					billingPeriod,
					billingMode,
					subscription,
					onSuccess: refreshSubscription,
					onClose: () => ModalToOpenService.removeModal(paymentModalId),
				},
			);
		},
		[refreshSubscription, subscription],
	);

	const openPayerTypeChooseModal = useCallback(
		(newSeatsCount: number, billingPeriod?: BillingPeriodCode) => {
			const payerTypeModalId = ModalToOpenService.addModal<ComponentProps<typeof PayerTypeChooseModal>>(
				ModalToOpen.GesCloudPayerTypeChoose,
				{
					onIndividualContinue: () => openPurchaseSeatPayModal(newSeatsCount, billingPeriod, "individual"),
					onLegalEntitySuccess: async () => {
						await refreshSubscription();
						openPurchaseSeatPayModal(newSeatsCount, billingPeriod, "legal_entity");
					},
					onClose: () => ModalToOpenService.removeModal(payerTypeModalId),
				},
			);
		},
		[openPurchaseSeatPayModal, refreshSubscription],
	);

	const openPaymentFlow = useCallback(
		async (newSeatsCount: number, billingPeriod?: BillingPeriodCode) => {
			try {
				const paymentMethods = await gesCloudApi.getPaymentMethods();
				if (paymentMethods.length > 0) {
					openPurchaseSeatPayModal(newSeatsCount, billingPeriod);
					return;
				}

				openPayerTypeChooseModal(newSeatsCount, billingPeriod);
			} catch {
				setSaveError(t("enterprise-cloud.org-settings.subscription.payment.payment-methods-load-error"));
			}
		},
		[gesCloudApi, openPurchaseSeatPayModal, openPayerTypeChooseModal],
	);

	const handleInviteClick = useCallback(() => {
		if (members.length >= maxSeats) {
			const newSeatsCount = maxSeats + 1;

			if (subscription?.plan === "paid") {
				openPurchaseSeatPayModal(newSeatsCount);
			} else {
				const subscriptionModalId = ModalToOpenService.addModal<ComponentProps<typeof TariffChooseModal>>(
					ModalToOpen.TariffChoose,
					{
						description: t("enterprise-cloud.org-settings.subscription.required-description"),
						onContinue: (billingPeriod) => void openPaymentFlow(newSeatsCount, billingPeriod),
						onClose: () => ModalToOpenService.removeModal(subscriptionModalId),
					},
				);
			}

			return;
		}

		const modalId = ModalToOpenService.addModal(ModalToOpen.GesCloudInviteMember, {
			onInvite: handleInviteMember,
			existingUsers: members.map((member) => member.email),
			onClose: () => ModalToOpenService.removeModal(modalId),
		});
	}, [handleInviteMember, members, maxSeats, subscription, openPurchaseSeatPayModal, openPaymentFlow]);

	if (isLoading) return <TabInitialLoader />;

	return (
		<div className="p-6">
			{subscription && <SubscriptionInactiveAlert subscriptionInfo={subscription} />}
			<FloatingAlert message={saveError} show={Boolean(saveError)} />

			<TableInfoBlock
				description={
					<span>
						{members.length}/{maxSeats}
					</span>
				}
				title={t("enterprise-cloud.org-settings.pages.users")}
			/>

			<div>
				<TableToolbar
					input={
						<TableToolbarTextInput
							onChange={handleFilterChange}
							placeholder={t("enterprise-cloud.org-settings.users.placeholder")}
							value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
						/>
					}
				>
					<AlertDeleteDialog
						hidden={!selectedCount}
						onConfirm={deleteSelected}
						selectedCount={selectedCount}
					/>

					<RefreshDataButton handleRefresh={refreshData} />

					<Button
						className="ml-auto"
						disabled={subscription?.status !== "active"}
						onClick={handleInviteClick}
						startIcon="user-plus"
						variant="outline"
					>
						{t("enterprise-cloud.org-settings.users.invite")}
					</Button>
				</TableToolbar>

				<TableComponent<GesCloudMember>
					columns={columns}
					onRowClick={(row: Row<GesCloudMember>) => singleSlot.openWith(row.original)}
					table={table}
				/>

				{isCurrentUserOwner && (
					<EditMemberModal
						onApply={setUserAdmin}
						onClose={singleSlot.close}
						open={singleSlot.isOpen}
						user={singleSlot.data}
					/>
				)}
			</div>
		</div>
	);
};

export default GesCloudUsersComponent;
