import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import t from "@ext/localization/locale/translate";

export const WORKSPACE_ACCESS_DENIED = "workspace-access-denied";

/**
 * The OS refused to let us read a workspace folder. One error for every refusal — macOS TCC on
 * ~/Desktop, a mode-bit lockout, a network share that logged us out — because the way out is the
 * same in all of them: grant access, or point Gramax at another folder.
 *
 * `props.errorCode` is what `GetErrorComponent` dispatches on; `props.path` is the folder to name
 * in the dialog, and it comes from here because `DiskFileProvider` prints its `_rootPath`, which
 * `MountFileProvider` leaves empty.
 */
export default class WorkspaceAccessDenied extends DefaultError {
	constructor(path: string, cause?: Error) {
		super(`${t("errors.workspace-access-denied")} ${path}`, cause, {
			errorCode: WORKSPACE_ACCESS_DENIED,
			path,
		});
		this.title = t("errors.workspace-access-denied-title");
	}
}
