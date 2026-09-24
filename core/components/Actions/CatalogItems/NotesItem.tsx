import CatalogItem from "@components/Actions/CatalogItems/Base";
import Icon from "@components/Atoms/Icon";
import IsReadOnlyHOC from "@core-ui/HigherOrderComponent/IsReadOnlyHOC";
import { INBOX_PANEL_ID } from "@ext/inbox/models/consts";
import t from "@ext/localization/locale/translate";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import type { ReactNode } from "react";

interface NotesItemProps {
	children?: ReactNode;
}

const NotesItem = ({ children }: NotesItemProps) => {
	const { toggle } = usePanelToggle(INBOX_PANEL_ID);

	return (
		<IsReadOnlyHOC>
			<CatalogItem
				renderLabel={(Item) => (
					<Item onSelect={toggle}>
						<Icon code="inbox" />
						{t("inbox.name")}
					</Item>
				)}
			>
				{children}
			</CatalogItem>
		</IsReadOnlyHOC>
	);
};

export default NotesItem;
