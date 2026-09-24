import type { EventHandlerCollection } from "@core/Event/EventHandlerProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Workspace } from "@ext/workspace/Workspace";
import { shortenEditorPath } from "./EnterpriseRouterPathEvents";
import { isManagedStorageSource } from "./isManagedStorageSource";

export default class ManagedStoragePathnameResolver implements EventHandlerCollection {
	constructor(private _workspace: Workspace) {}

	mount(): void {
		this._workspace.getFileStructure().events.on("catalog-pathname-resolve", async ({ pathnameData, mutable }) => {
			if (isManagedStorageSource(await this._workspace.config(), pathnameData.sourceName))
				mutable.pathname = shortenEditorPath(new Path(mutable.pathname)).value;
		});
	}
}
