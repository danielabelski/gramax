import type { PlaywrightPage } from "@shared-pom/page";
import { evaluateOnApp } from "@utils/app";

export class CatalogPom {
	constructor(
		private _page: PlaywrightPage,
		private _name: string,
	) {}

	async props() {
		return evaluateOnApp(
			this._page,
			async (name: string) => {
				const { wm } = await window.app!;
				const catalog = await wm.current().getContextlessCatalog(name);
				return { ...catalog.props };
			},
			this._name,
		);
	}

	/** Where the catalog's root category sits on disk — `<catalog>/<docroot>` once a docroot is set. */
	async rootCategoryPath(): Promise<string> {
		return evaluateOnApp(
			this._page,
			async (name: string) => {
				const { wm } = await window.app!;
				const catalog = await wm.current().getContextlessCatalog(name);
				return catalog.getRootCategoryPath().value;
			},
			this._name,
		);
	}
}
