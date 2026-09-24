import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { downloadFile } from "@core-ui/downloadResource";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { TabInitialLoader } from "@ext/enterprise/components/admin/ui-kit/TabInitialLoader";
import { TableComponent } from "@ext/enterprise/components/admin/ui-kit/table/TableComponent";
import { GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { getCoreRowModel, useReactTable } from "@ui-kit/DataTable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StickyHeader } from "../../components/StickyHeader";
import { getGesCloudInvoicesTableColumns } from "./config/GesCloudDocumentsTableConfig";
import type { GesCloudInvoice } from "./types/GesCloudDocumentsComponentTypes";

const GesCloudDocumentsComponent = () => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [invoices, setInvoices] = useState<GesCloudInvoice[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [saveError, setSaveError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const data = await gesCloudApi.getInvoices();
		setInvoices(data);
	}, [gesCloudApi]);

	const downloadInvoice = useCallback(
		async (invoiceId: string) => {
			const invoice = await gesCloudApi.getInvoicePdf(invoiceId);

			downloadFile(invoice.data, MimeTypes.pdf, invoice.fileName);
		},
		[gesCloudApi],
	);

	useEffect(() => {
		const init = async () => {
			try {
				await refresh();
			} catch {
				setSaveError(t("enterprise-cloud.org-settings.documents.error"));
			} finally {
				setIsLoading(false);
			}
		};

		void init();
	}, [refresh]);

	const columns = useMemo(() => getGesCloudInvoicesTableColumns(downloadInvoice), [downloadInvoice]);

	const table = useReactTable({
		data: invoices,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) return <TabInitialLoader />;

	return (
		<div className="p-6">
			<StickyHeader title={t("enterprise-cloud.org-settings.documents.title")} />

			<FloatingAlert message={saveError} show={Boolean(saveError)} />

			<div>
				<TableComponent<GesCloudInvoice> columns={columns} table={table} />
			</div>
		</div>
	);
};

export default GesCloudDocumentsComponent;
