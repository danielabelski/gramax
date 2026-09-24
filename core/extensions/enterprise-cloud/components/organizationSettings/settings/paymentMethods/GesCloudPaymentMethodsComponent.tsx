import resolveFrontendModule from "@app/resolveModule/frontend";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { AlertDeleteDialog } from "@ext/enterprise/components/admin/ui-kit/AlertDeleteDialog";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { GesCloudApi, type GesCloudPaymentMethod, type GesCloudSubscription } from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { getCoreRowModel, useReactTable } from "@ui-kit/DataTable";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import type { AlertConfirm } from "../../../../../../ui-kit/components/AlertDialog";
import ModalToOpenService from "../../../../../../ui-logic/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "../../../../../../ui-logic/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { TabInitialLoader } from "../../../../../enterprise/components/admin/ui-kit/TabInitialLoader";
import { TableComponent } from "../../../../../enterprise/components/admin/ui-kit/table/TableComponent";
import { TableToolbar } from "../../../../../enterprise/components/admin/ui-kit/table/TableToolbar";
import { RefreshDataButton } from "../../components/RefreshDataButton";
import { StickyHeader } from "../../components/StickyHeader";
import type { CancelSubscriptionModal } from "../components/CancelSubscriptionModal";
import { getGesCloudPaymentMethodsTableColumns } from "./config/GesCloudPaymentMethodsTableConfig";

const TAURI_PAYMENT_METHOD_RETURN_URL = "http://localhost:52054";

export type GesCloudPaymentMethodsComponentProps = {
	subscription: GesCloudSubscription | null;
};

const GesCloudPaymentMethodsComponent = ({ subscription }: GesCloudPaymentMethodsComponentProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const { isTauri } = usePlatform();
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [paymentMethods, setPaymentMethods] = useState<GesCloudPaymentMethod[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isBinding, setIsBinding] = useState(false);
	const [rowSelection, setRowSelection] = useState({});
	const [saveError, setSaveError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			setIsLoading(true);
			const paymentMethodsData = await gesCloudApi.getPaymentMethods();
			setPaymentMethods(paymentMethodsData);
			setRowSelection({});
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to load payment methods");
		} finally {
			setIsLoading(false);
		}
	}, [gesCloudApi]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const columns = useMemo(() => getGesCloudPaymentMethodsTableColumns(), []);

	const table = useReactTable({
		data: paymentMethods,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			rowSelection,
		},
		defaultColumn: { size: 0 },
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: selection-dependent buttons wont update without this
	const selectedRows = useMemo(() => table.getFilteredSelectedRowModel().rows, [table, rowSelection]);

	const deletePaymentMethods = useCallback(async () => {
		setSaveError(null);
		try {
			const idList = selectedRows.map((row) => row.original.id);
			await gesCloudApi.deletePaymentMethods(idList);

			await refresh();
		} catch {
			setSaveError(t("enterprise-cloud.org-settings.payment-methods.delete-error"));
		}
	}, [selectedRows, gesCloudApi, refresh]);

	const openChooseAnotherDefaultMethodModal = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof AlertConfirm>>(ModalToOpen.AlertConfirm, {
			description: t("enterprise-cloud.org-settings.payment-methods.make-another-default.description"),
			icon: "alert-circle",
			status: "warning",
			title: t("enterprise-cloud.org-settings.payment-methods.make-another-default.title"),
			onCancel: () => ModalToOpenService.removeModal(modalId),
			cancelText: t("close"),
		});
	}, []);

	const openCancelSubscriptionModal = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof CancelSubscriptionModal>>(
			ModalToOpen.CancelSubscription,
			{
				currentPeriodEnd: subscription?.currentPeriodEnd,
				freeSeatsLimit: subscription?.seatsInfo.freeSeatsLimit,
				occupiedSeats: subscription?.seatsInfo.occupiedSeats,
				onClose: () => ModalToOpenService.removeModal(modalId),
				onConfirm: async () => {
					ModalToOpenService.removeModal(modalId);
					await deletePaymentMethods();
				},
			},
		);
	}, [subscription, deletePaymentMethods]);

	const handleSetDefault = useCallback(async () => {
		if (selectedRows.length !== 1) return;

		setSaveError(null);
		try {
			await gesCloudApi.setDefaultPaymentMethod(selectedRows[0].original.id);
			await refresh();
		} catch {
			setSaveError(t("enterprise-cloud.org-settings.payment-methods.set-default-error"));
		}
	}, [selectedRows, gesCloudApi, refresh]);

	const handleDelete = useCallback(async () => {
		setSaveError(null);

		const defaultPaymentMethodRow = selectedRows.find((row) => row.original.isDefault);
		if (defaultPaymentMethodRow) {
			if (paymentMethods.length > selectedRows.length) {
				openChooseAnotherDefaultMethodModal();
				return;
			}

			if (subscription.plan === "paid") {
				openCancelSubscriptionModal();
				return;
			}
		}

		await deletePaymentMethods();
	}, [
		selectedRows,
		openChooseAnotherDefaultMethodModal,
		openCancelSubscriptionModal,
		paymentMethods.length,
		deletePaymentMethods,
		subscription.plan,
	]);

	const handleAdd = useCallback(async () => {
		setIsBinding(true);
		setSaveError(null);
		try {
			const idempotenceKey = globalThis.crypto.randomUUID();
			const returnUrl = isTauri ? TAURI_PAYMENT_METHOD_RETURN_URL : window.location.href;
			const result = await gesCloudApi.bindPaymentMethod(idempotenceKey, { returnUrl });

			if (result.status === "redirect") {
				if (isTauri) {
					await resolveFrontendModule("gesCloudPaymentMethodBinding")(result.confirmationUrl);
					const bindingStatus = await gesCloudApi.getPaymentMethodBindingStatus();
					await refresh();
					if (bindingStatus === "inactive")
						setSaveError(t("enterprise-cloud.org-settings.payment-methods.bind-error"));
				} else {
					window.location.href = result.confirmationUrl;
				}
			}
		} catch {
			setSaveError(t("enterprise-cloud.org-settings.payment-methods.bind-error"));
		} finally {
			setIsBinding(false);
		}
	}, [gesCloudApi, isTauri, refresh]);

	if (isLoading) return <TabInitialLoader />;

	return (
		<div className="p-6">
			<StickyHeader title={t("enterprise-cloud.org-settings.payment-methods.title")} />

			<FloatingAlert message={saveError} show={Boolean(saveError)} />

			<div>
				<TableToolbar>
					<div className="ml-auto flex items-center gap-2">
						<AlertDeleteDialog
							hidden={!selectedRows.length}
							onConfirm={handleDelete}
							selectedCount={selectedRows.length}
						/>

						<RefreshDataButton handleRefresh={refresh} />

						<Button
							disabled={selectedRows.length !== 1}
							onClick={handleSetDefault}
							startIcon="star"
							variant="outline"
						>
							{t("enterprise-cloud.org-settings.payment-methods.set-default")}
						</Button>

						<Button disabled={isBinding} onClick={handleAdd} startIcon="plus" variant="outline">
							{t("enterprise-cloud.org-settings.payment-methods.add")}
						</Button>
					</div>
				</TableToolbar>

				<TableComponent<GesCloudPaymentMethod> columns={columns} table={table} />
			</div>
		</div>
	);
};

export default GesCloudPaymentMethodsComponent;
