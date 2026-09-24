import generateUniqueID from "@core/utils/generateUniqueID";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import type { ProviderContextService, ProviderItemProps } from "@ext/articleProvider/models/types";
import ArticleTemplate from "@ext/templates/components/ArticleTemplate";
import type { TemplateItemProps } from "@ext/templates/components/TemplatesPanel/types/constants";
import { createContext, useContext, useState } from "react";

export type TemplateContextType = {
	templates: Map<string, TemplateItemProps>;
	selectedID: string;
};

export const TemplateContext = createContext<TemplateContextType>({
	templates: new Map(),
	selectedID: null,
});

class TemplateService implements ProviderContextService {
	private _setTemplates: (templates: Map<string, TemplateItemProps>) => void = () => {};
	private _setSelectedID: (selectedID: string) => void = () => {};
	private _templates = new Map<string, TemplateItemProps>();
	private _isNext: boolean;

	Init = ({ children }: { children: JSX.Element }): JSX.Element => {
		const [templates, setTemplates] = useState<Map<string, TemplateItemProps>>(new Map());
		const [selectedID, setSelectedID] = useState<string>(null);
		const { isNext } = usePlatform();

		this._isNext = isNext;
		this._templates = templates;
		this._setTemplates = setTemplates;
		this._setSelectedID = setSelectedID;
		return <TemplateContext.Provider value={{ templates, selectedID }}>{children}</TemplateContext.Provider>;
	};

	get value(): TemplateContextType {
		return useContext(TemplateContext);
	}

	async fetchItems(apiUrlCreator: ApiUrlCreator) {
		const url = apiUrlCreator.getArticleListInGramaxDir("template");
		const res = await FetchService.fetch(url);

		if (!res.ok) return;
		const templates = await res.json();

		this.setItems(templates);
	}

	setItems(templates: TemplateItemProps[]) {
		this._templates = new Map(templates.map((template) => [template.id, template]));
		this._setTemplates(this._templates);
	}

	closeItem() {
		ArticleViewService.setDefaultView();
		if (!this._isNext) refreshPage();
		this._setSelectedID(null);
	}

	openItem(template: TemplateItemProps) {
		ArticleViewService.setView(() => <ArticleTemplate item={template} />);
		this._setSelectedID(template.id);
	}

	async addNewTemplate(apiUrlCreator: ApiUrlCreator) {
		const uniqueID = generateUniqueID();
		const createResponse = await FetchService.fetch(apiUrlCreator.createFileInGramaxDir(uniqueID, "template"));
		if (!createResponse.ok) return;

		const createdTemplate: TemplateItemProps = { id: uniqueID, title: "" };

		const res = await FetchService.fetch<ProviderItemProps[]>(apiUrlCreator.getArticleListInGramaxDir("template"));
		if (!res.ok) {
			this.setItems([...this._templates.values(), createdTemplate]);
			return createdTemplate;
		}

		const newTemplates = await res.json();
		const addedTemplate = newTemplates.find((template) => template.id === uniqueID);
		this.setItems(addedTemplate ? newTemplates : [...newTemplates, createdTemplate]);
		return addedTemplate ?? createdTemplate;
	}
}

export default new TemplateService();
