/** biome-ignore-all lint/complexity/noStaticOnlyClass: expected*/
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import type { InboxArticle } from "@ext/inbox/models/types";
import { createContext, type Dispatch, type SetStateAction, useContext, useState } from "react";

export type InboxContextType = {
	items: InboxArticle[];
};

export const InboxContext = createContext<InboxContextType>({
	items: [],
});

let SetItems: Dispatch<SetStateAction<InboxArticle[]>> = () => {};

const serializeInboxItems = (items: InboxArticle[]) =>
	JSON.stringify([...items].sort((left, right) => left.id.localeCompare(right.id)));

export const preserveEqualInboxItems = (current: InboxArticle[], refreshed: InboxArticle[]): InboxArticle[] =>
	serializeInboxItems(current) === serializeInboxItems(refreshed) ? current : refreshed;

abstract class InboxService {
	static Provider = ({ children }: { children: JSX.Element }): JSX.Element => {
		const [items, setItems] = useState<InboxArticle[]>([]);

		SetItems = setItems;
		return this.Context({ children, value: { items } });
	};

	static Context = ({ children, value }: { children: JSX.Element; value: InboxContextType }): JSX.Element => {
		return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
	};

	static get value(): InboxContextType {
		return useContext(InboxContext);
	}

	static setItems(items: InboxArticle[]) {
		SetItems((current) => preserveEqualInboxItems(current, items));
	}

	static removeItem(id: string) {
		SetItems((current) => current.filter((item) => item.id !== id));
	}

	static restoreItem(item: InboxArticle) {
		SetItems((current) =>
			current.some((currentItem) => currentItem.id === item.id) ? current : [...current, item],
		);
	}

	static async fetchInbox(mail: string, apiUrlCreator: ApiUrlCreator) {
		const url = apiUrlCreator.getInboxArticles(mail);
		const res = await FetchService.fetch(url);

		if (!res.ok) return;
		const items: InboxArticle[] = await res.json();

		this.setItems(items);
	}

	static removeAllItems() {
		SetItems([]);
	}
}

export default InboxService;
