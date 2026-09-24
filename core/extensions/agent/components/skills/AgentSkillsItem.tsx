import CatalogItem from "@components/Actions/CatalogItems/Base";
import Icon from "@components/Atoms/Icon";
import { AGENT_SKILLS_PANEL_ID } from "@ext/agent/components/types/constants";
import t from "@ext/localization/locale/translate";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import type { ReactNode } from "react";

interface AgentSkillsItemProps {
	children?: ReactNode;
}

const AgentSkillsItem = ({ children }: AgentSkillsItemProps) => {
	const { toggle } = usePanelToggle(AGENT_SKILLS_PANEL_ID);

	return (
		<CatalogItem
			renderLabel={(Item) => (
				<Item onSelect={toggle}>
					<Icon code="square-chevron-right" />
					{t("agent.skills.name")}
				</Item>
			)}
		>
			{children}
		</CatalogItem>
	);
};

export default AgentSkillsItem;
