import { default as SharedPage } from "@shared-pom/page";
import { CatalogPom } from "./catalog.pom";
import { GitPom } from "./git.pom";
import { WorkspacePom } from "./workspace.pom";

export default class BasePage extends SharedPage {
	catalog(name: string): CatalogPom {
		return new CatalogPom(this._page, name);
	}

	git(): GitPom {
		return new GitPom(this._page);
	}

	workspace(): WorkspacePom {
		return new WorkspacePom(this._page);
	}
}
