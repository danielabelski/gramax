import BaseArticleView from "@ext/articleProvider/components/BaseArticleView";
import t from "@ext/localization/locale/translate";
import { Placeholder } from "@ext/markdown/elements/placeholder/placeholder";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import TemplateService from "@ext/templates/components/TemplateService";
import type { TemplateItemProps } from "@ext/templates/components/TemplatesPanel/types/constants";
import { updateTemplateItem } from "@ext/templates/logic/updateTemplateItem";
import type { JSONContent } from "@tiptap/core";
import { useEffect } from "react";

interface ArticleTemplateProps {
	item: TemplateItemProps;
}

const ArticleTemplate = ({ item }: ArticleTemplateProps) => {
	const { templates } = TemplateService.value;

	useEffect(() => {
		const listener = () => TemplateService.closeItem();
		const clickToken = NavigationEvents.on("item-click", listener);
		const createToken = NavigationEvents.on("item-create", listener);
		const deleteToken = NavigationEvents.on("item-delete", listener);

		return () => {
			NavigationEvents.off(clickToken);
			NavigationEvents.off(createToken);
			NavigationEvents.off(deleteToken);
		};
	}, []);

	const updateContent = (id: string, content: JSONContent, title: string) => {
		const template = templates.get(id);
		if (!template) return;

		TemplateService.setItems(
			Array.from(templates.values()).map((current) =>
				current.id === id ? updateTemplateItem(template, content, title) : current,
			),
		);
	};

	const onCloseClick = () => {
		TemplateService.closeItem();
	};

	return (
		<BaseArticleView
			extensions={[
				Placeholder.configure({
					placeholder: ({ editor, node }) => {
						if (
							editor.state.doc.firstChild.type.name === "paragraph" &&
							editor.state.doc.firstChild === node
						)
							return t("template.placeholders.title");

						if (
							node.type.name === "paragraph" &&
							editor.state.doc.content.child(1) === node &&
							editor.state.doc.content.childCount === 2
						)
							return t("template.placeholders.content");
					},
				}),
			]}
			extensionsOptions={{ isTemplateInstance: false }}
			item={item}
			menuOptions={{ isTemplate: true }}
			onCloseClick={onCloseClick}
			onUpdate={updateContent}
			providerType="template"
		/>
	);
};

export default ArticleTemplate;
