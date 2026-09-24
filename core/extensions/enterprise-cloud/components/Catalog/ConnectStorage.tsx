import { NEW_CATALOG_NAME } from "@app/config/const";
import { useRouter } from "@core/Api/useRouter";
import type { ClientCatalogProps } from "@core/SitePresenter/SitePresenter";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import type { GesCloudInitCatalog } from "@ext/enterprise-cloud/components/Catalog/GesCloudInitCatalog";
import ErrorConfirmService from "@ext/errorHandlers/client/ErrorConfirmService";
import { type ComponentProps, cloneElement, useCallback, useState } from "react";
import ApiUrlCreatorService from "../../../../ui-logic/ContextServices/ApiUrlCreator";
import type { PreparedGitStorageData } from "../../logic/Catalog/InitNewCatalogResult";

interface CatalogRepositoryNameResponse {
	repositoryName: string;
	isRepositoryNameAlreadyExists: boolean;
}

type InitNewCatalogResult = { success: true; catalogProps: ClientCatalogProps };

type PrepareNewCatalogResult =
	| { success: true; catalogProps: ClientCatalogProps; data: PreparedGitStorageData }
	| { success: false; errorCode: "REPOSITORY_ALREADY_EXISTS" };

export const GesCloudConnectStorage = ({ trigger }: { trigger: JSX.Element }) => {
	const catalogPropsStore = useCatalogPropsStore((state) => state, "shallow");
	const apiUrlCreator = ApiUrlCreatorService.value;
	const router = useRouter();

	const [isConnectingCatalog, setIsConnectingCatalog] = useState(false);

	const connectStorage = useCallback(
		async (newCatalogTitle: string, newRepositoryName: string) => {
			const oldCatalogName = catalogPropsStore.data.repositoryName;
			const prepareRes = await FetchService.fetch<PrepareNewCatalogResult>(
				apiUrlCreator.getPrepareEnterpriseCloudCatalogUrl(oldCatalogName, newCatalogTitle, newRepositoryName),
			);
			if (!prepareRes.ok) return;

			const prepareResult = await prepareRes.json();
			if (!prepareResult.success) return prepareResult;

			catalogPropsStore.update(prepareResult.catalogProps);
			const currentCatalogName = prepareResult.catalogProps.repositoryName;

			const res = await FetchService.fetch<InitNewCatalogResult>(
				apiUrlCreator.getInitEnterpriseCloudCatalogUrl(currentCatalogName),
				JSON.stringify(prepareResult.data),
				MimeTypes.json,
			);
			if (!res.ok) return;

			const result = await res.json();
			if (!result.success) return result;

			catalogPropsStore.update(result.catalogProps);
			router.pushPath(result.catalogProps.link.pathname);
			return result;
		},
		[catalogPropsStore, router],
	);

	const getRepositoryName = useCallback(
		async (catalogTitle: string) => {
			const oldCatalogName = catalogPropsStore.data.repositoryName;

			const res = await FetchService.fetch<CatalogRepositoryNameResponse>(
				apiUrlCreator.getEnterpriseCloudCatalogRepositoryNameUrl(oldCatalogName, catalogTitle),
			);
			if (!res.ok) throw new Error(`Failed to get catalog repository name: ${res.status}`);

			const data = await res.json();
			return data;
		},
		[catalogPropsStore.data.repositoryName],
	);

	const handleClick = useCallback(async () => {
		if (isConnectingCatalog) return;
		setIsConnectingCatalog(true);
		try {
			const catalogTitle = catalogPropsStore.data.title?.trim() ?? "";
			const repositoryNameData = await getRepositoryName(catalogTitle || NEW_CATALOG_NAME);

			if (!catalogTitle || repositoryNameData.isRepositoryNameAlreadyExists) {
				const id = ModalToOpenService.addModal<ComponentProps<typeof GesCloudInitCatalog>>(
					ModalToOpen.GesCloudInitCatalog,
					{
						initialCatalogTitle: catalogTitle,
						initialRepositoryName: catalogPropsStore.data.name,
						onClose: () => {
							setIsConnectingCatalog(false);
							ModalToOpenService.removeModal(id);
						},
						connectStorage,
					},
				);
				return;
			}

			await connectStorage(catalogTitle, repositoryNameData.repositoryName);
		} catch (error) {
			ErrorConfirmService.notify(error);
		} finally {
			setIsConnectingCatalog(false);
		}
	}, [
		catalogPropsStore.data.name,
		catalogPropsStore.data.title,
		connectStorage,
		getRepositoryName,
		isConnectingCatalog,
	]);

	return cloneElement(trigger, {
		disabled: isConnectingCatalog,
		onClick: handleClick,
	});
};
