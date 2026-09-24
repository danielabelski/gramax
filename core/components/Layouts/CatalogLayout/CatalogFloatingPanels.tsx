import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { AgentChatPanel } from "@ext/agent/components/panel/AgentChatPanel";
import { AgentSkillsPanel } from "@ext/agent/components/skills/panel/AgentSkillsPanel";
import { BranchPanel } from "@ext/git/actions/Branch/BranchPanel/BranchPanel";
import { HistoryPanel } from "@ext/git/actions/Revisions/HistoryPanel/HistoryPanel";
import { MergeRequestPanel } from "@ext/git/core/GitMergeRequest/MergeRequestPanel/MergeRequestPanel";
import { PublishPanel } from "@ext/git/core/GitPublish/PublishPanel/PublishPanel";
import { InboxPanel } from "@ext/inbox/components/InboxPanel/InboxPanel";
import { FragmentsPanel } from "@ext/markdown/elements/fragment/edit/components/FragmentsPanel/FragmentsPanel";
import { ReviewPanel } from "@ext/review/components/ReviewPanel/ReviewPanel";
import { TemplatesPanel } from "@ext/templates/components/TemplatesPanel/TemplatesPanel";

export const CatalogFloatingPanels = () => {
	const { isNext } = usePlatform();
	const isReadonly = PageDataContext.value?.conf?.isReadOnly;

	return (
		<>
			{!isNext && !isReadonly && (
				<>
					<PublishPanel />
					<MergeRequestPanel />
					<ReviewPanel />
					<InboxPanel />
					<AgentChatPanel />
					<AgentSkillsPanel />
					<TemplatesPanel />
					<FragmentsPanel />
				</>
			)}
			{!isNext && <HistoryPanel />}
			{!isReadonly && <BranchPanel />}
		</>
	);
};
