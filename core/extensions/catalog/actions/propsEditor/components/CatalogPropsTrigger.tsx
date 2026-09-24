import CatalogItem from "@components/Actions/CatalogItems/Base";
import Icon from "@components/Atoms/Icon";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import t from "@ext/localization/locale/translate";
import { Level } from "@ext/settings/logic/settings";
import type { ComponentProps, ReactNode } from "react";
import PageDataContext from "../../../../../ui-logic/ContextServices/PageDataContext";
import type GesCloudAppSettingsEditor from "../../../../enterprise-cloud/components/GesCloudAppSettingsEditor";

const CatalogPropsTrigger = ({ children }: { children?: ReactNode }) => {
	const isCloud = Boolean(PageDataContext.value.conf.enterpriseCloud.url);

	const onSelect = () => {
		if (isCloud) {
			ModalToOpenService.setValue<ComponentProps<typeof GesCloudAppSettingsEditor>>(ModalToOpen.GesAppSettings, {
				defaultLevel: Level.catalog,
				onClose: () => ModalToOpenService.resetValue(),
			});
		} else {
			ModalToOpenService.setValue(ModalToOpen.AppSettings, {
				defaultLevel: Level.catalog,
				onClose: () => ModalToOpenService.resetValue(),
			});
		}
	};

	return (
		<CatalogItem
			renderLabel={(Component) => (
				<Component onSelect={onSelect}>
					<Icon code="square-pen" />
					{t("catalog.configure")}
				</Component>
			)}
		>
			{children}
		</CatalogItem>
	);
};

export default CatalogPropsTrigger;
