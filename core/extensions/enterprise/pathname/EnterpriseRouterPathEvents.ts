import type { UnsubscribeToken } from "@core/Event/EventEmitter";
import type { EventHandlerCollection } from "@core/Event/EventHandlerProvider";
import Path from "@core/FileProvider/Path/Path";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { showGesRequiredModal } from "./showGesRequiredModal";

export const isShortEditorPath = (segments: string[]): boolean => {
	const offset = segments[0] === "public" ? 1 : 0;
	return (
		segments.slice(offset, offset + 3).length === 3 &&
		segments.slice(offset, offset + 3).every((segment) => segment !== "-") &&
		segments[offset + 3] === "-"
	);
};

export const expandShortEditorPath = (segments: string[]): string[] =>
	segments[0] === "public" ? ["public", "-", ...segments.slice(1)] : ["-", ...segments];

export const shortenEditorPath = (path: Path): Path => new Path(path.value.split("/").slice(1));

export default class EnterpriseRouterPathEvents implements EventHandlerCollection {
	private _tokens: UnsubscribeToken[] = [];

	constructor(private _workspaceManager?: WorkspaceManager) {}

	mount(): void {
		if (this._tokens.length) return;
		this._tokens = [
			RouterPathProvider.events.on("parse-path", ({ segments, mutable }) => {
				if (isShortEditorPath(segments))
					mutable.data = RouterPathProvider.parseEditorPath(expandShortEditorPath(segments));
			}),
			RouterPathProvider.events.on("is-editor-path", ({ segments, mutable }) => {
				const offset = segments[0] === "public" ? 1 : 0;
				if (isShortEditorPath(segments) || segments[offset + 4] === "-") mutable.value = true;
			}),
			RouterPathProvider.events.on("generate-path", ({ data, mutable }) => {
				if (!data.sourceName && data.group && data.repo) mutable.path = shortenEditorPath(mutable.path);
			}),
			RouterPathProvider.events.on("unresolved-path", ({ path, mutable }) => {
				const segments = RouterPathProvider.parseItemLogicPath(new Path(path)).fullPath;
				const config = this._workspaceManager?.maybeCurrent()?.yaml().inner();
				const isManagedWorkspace = config?.enterprise?.gesUrl || config?.enterpriseCloud?.url;
				if (!isShortEditorPath(segments) || isManagedWorkspace) return;
				mutable.handled = true;
				showGesRequiredModal();
			}),
		];
	}

	unmount(): void {
		this._tokens.forEach((token) => RouterPathProvider.events.off(token));
		this._tokens = [];
	}
}
