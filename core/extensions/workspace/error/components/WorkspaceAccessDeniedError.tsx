import { getExecutingEnvironment } from "@app/resolveModule/env";
import resolveModule from "@app/resolveModule/frontend";
import openNewTab from "@core-ui/utils/openNewTab";
import { DialogErrorHeader } from "@ext/errorHandlers/client/components/DialogErrorHeader";
import type { GetErrorComponentProps } from "@ext/errorHandlers/logic/GetErrorComponent";
import t from "@ext/localization/locale/translate";
import systemSettingsUrl from "@ext/workspace/error/systemSettingsUrl";
import tccCategory from "@ext/workspace/error/tccCategory";
import { DialogBody, DialogFooterTemplate } from "@ui-kit/Dialog";

/**
 * Shown when the OS refuses a workspace directory. Only macOS gates directories behind a settings
 * pane we can deep-link into; on Windows and Linux the refusal is ordinary filesystem permissions,
 * so the useful move there is to put the directory in front of the user in their file manager.
 */
const WorkspaceAccessDeniedError = ({ error, onCancelClick }: GetErrorComponentProps) => {
	const path = error.props?.path as string;

	// Desktop first, user agent second. The directory lives wherever the backend runs, so a Mac
	// browser pointed at a Linux server must not be told to open macOS Privacy & Security — and
	// no browser can grant TCC anyway.
	const isDesktop = getExecutingEnvironment() === "tauri";
	const settingsUrl = isDesktop
		? systemSettingsUrl(typeof navigator === "undefined" ? undefined : navigator.userAgent)
		: null;

	// The macOS pane has a toggle per category, named after the category rather than the folder.
	// Name it when the path is under one; outside them there is nothing specific to point at.
	const category = tccCategory(path);
	const hint = !settingsUrl
		? t("errors.workspace-access-denied-other")
		: category
			? t("errors.workspace-access-denied-macos-category").replace(
					"{{category}}",
					t(`errors.tcc-category.${category}`),
				)
			: t("errors.workspace-access-denied-macos");

	const action = settingsUrl
		? { text: t("errors.open-system-settings"), onClick: () => openNewTab(settingsUrl) }
		: isDesktop && path
			? { text: t("open-in.explorer"), onClick: () => resolveModule("openInExplorer")(path) }
			: null;

	return (
		<>
			<DialogErrorHeader error={error} title={t("errors.workspace-access-denied-title")} />
			<DialogBody>
				{/* `.article` is what gives inline `<code>` its grey pill (`.article code` in article.css);
				    `!bg-transparent` drops the page background it also carries, same as CatalogExistsError.
				    Spacing lives on this wrapper because DialogBody does not pass `className` through. */}
				<div className="article !bg-transparent flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<span>
							{path ? t("errors.workspace-access-denied") : t("errors.workspace-access-denied-title")}
						</span>
						{/* Own line: mid-sentence the path wraps and cuts the text in half. `.article code`
						    ships `margin: 1em 0` and 2px of padding — the margin fights the flex gap and the
						    padding is too tight for a pill on its own line, so both are overridden here. */}
						{path && <code className="!my-0 w-fit max-w-full break-all px-1.5 py-1">{path}</code>}
					</div>
					<span>{hint}</span>
				</div>
			</DialogBody>
			<DialogFooterTemplate
				primaryButton={action ? action.text : t("ok")}
				primaryButtonProps={{ onClick: action ? action.onClick : onCancelClick }}
			/>
		</>
	);
};

export default WorkspaceAccessDeniedError;
