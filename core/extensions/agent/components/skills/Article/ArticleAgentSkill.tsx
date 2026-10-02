import ArticleLoadingView from "@core-ui/ContextServices/views/articleView/ArticleLoadingView";
import AgentSkillService from "@ext/agent/components/skills/AgentSkillService";
import { useAgentSecretNames } from "@ext/agent/components/utils/secret/useAgentSecretNames";
import BaseArticleView from "@ext/articleProvider/components/BaseArticleView";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import { Placeholder } from "@ext/markdown/elements/placeholder/placeholder";
import SecretNode from "@ext/markdown/elements/secret/edit/model/secretNode";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import type { JSONContent } from "@tiptap/core";
import { useEffect } from "react";

const AgentSkillPlaceholder = Placeholder.configure({
	placeholder: ({ editor, node }) => {
		const { doc } = editor.state;
		if (doc.firstChild === node) return t("agent.skills.title-placeholder");
		if (doc.childCount === 2 && doc.content.child(1) === node) return t("agent.skills.content-placeholder");
	},
});

interface ArticleAgentSkillProps {
	item: ProviderItemProps;
}

const ArticleAgentSkill = ({ item }: ArticleAgentSkillProps) => {
	const { skills, remoteVersion } = AgentSkillService.value;
	const liveItem = skills.get(item.id) ?? item;
	const knownSecretNames = useAgentSecretNames();

	useEffect(() => {
		const closeItem = () => AgentSkillService.closeItem();
		const tokens = [
			NavigationEvents.on("item-click", closeItem),
			NavigationEvents.on("item-create", closeItem),
			NavigationEvents.on("item-delete", closeItem),
		];
		return () => tokens.forEach((token) => NavigationEvents.off(token));
	}, []);

	const updateContent = (id: string, _content: JSONContent, title: string) => {
		const skill = skills.get(id);
		if (!skill) return;

		if (skill.title !== title) {
			skill.title = title.trim();
		}

		AgentSkillService.setItems(Array.from(skills.values()));
	};

	if (!knownSecretNames) return <ArticleLoadingView />;

	return (
		<BaseArticleView
			extensions={[AgentSkillPlaceholder, SecretNode.configure({ knownNames: knownSecretNames })]}
			item={liveItem}
			key={`${liveItem.id}:${remoteVersion}`}
			onCloseClick={() => AgentSkillService.closeItem()}
			onUpdate={updateContent}
			providerType="agentSkill"
		/>
	);
};

export default ArticleAgentSkill;
