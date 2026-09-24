import { CatalogView } from "@ext/catalog/views/components/CatalogView";
import SwitchContentLanguage from "@ext/localization/actions/SwitchContentLanguage";
import SwitchVersion from "@ext/versioning/components/SwitchVersion";

/** Catalog-scoped switches — which version and which view of the catalog is resolved. */
export const CatalogSection = () => (
	<div>
		<SwitchContentLanguage />
		<SwitchVersion />
		<CatalogView />
	</div>
);
