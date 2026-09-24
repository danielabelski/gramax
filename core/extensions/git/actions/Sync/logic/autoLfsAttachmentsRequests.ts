import type { EnableAutoLfsAttachmentsResult } from "@app/commands/versionControl/lfs/enableAutoLfsAttachments";
import type { AttachmentsMigrationStats } from "@app/commands/versionControl/lfs/getAttachmentsMigrationStats";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ErrorConfirmService from "@ext/errorHandlers/client/ErrorConfirmService";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";

/**
 * What the enable ended up doing. `enabled` is `true` only when the command actually saved the
 * setting; `patterns` is the mask list `.gitattributes` carries afterwards, so the form can replace
 * the copy it read at mount instead of saving a pre-migration one back over it.
 */
export type AutoLfsEnableOutcome = {
	enabled: boolean;
	mergeData?: MergeData;
	patterns?: string[];
};

/**
 * How much the enable would move, and which masks it would append. `null` means the check itself
 * failed — `FetchService` has already told the user. The exclusions travel with the request so the
 * numbers describe the migration about to run, not the one `.doc-root.yaml` was last saved with.
 */
export const requestAttachmentsMigrationStats = async (
	apiUrlCreator: ApiUrlCreator,
	exclude: string[],
): Promise<AttachmentsMigrationStats | null> => {
	const res = await FetchService.fetch<AttachmentsMigrationStats>(
		apiUrlCreator.getAttachmentsMigrationStats(),
		JSON.stringify({ exclude }),
		MimeTypes.json,
		Method.POST,
	);
	if (!res.ok) return null;
	return await res.json();
};

/**
 * Saves the setting and runs the migration. Throws only when the request never produced a response —
 * `FetchService` has no catch of its own, so a dropped connection propagates out of here.
 */
export const requestEnableAutoLfsAttachments = async (
	apiUrlCreator: ApiUrlCreator,
	exclude: string[],
): Promise<AutoLfsEnableOutcome> => {
	const res = await FetchService.fetch<EnableAutoLfsAttachmentsResult>(
		apiUrlCreator.enableAutoLfsAttachments(),
		JSON.stringify({ exclude }),
		MimeTypes.json,
	);
	// `res.ok` is not the answer: the command replies 200 with `migrated: false` from every path that
	// never reached `catalog.updateProps` — not a workdir repo, no storage, read-only, no source data,
	// and above all a sync that ended in a merge conflict. `mergeData` still travels either way.
	const body = res.ok ? await res.json() : undefined;
	// A 200 carrying `error` is the committed-then-push-failed path, so `FetchService`'s own
	// notify-on-error never fires. Raise it here, or the user walks away thinking the push went through.
	if (body?.error) ErrorConfirmService.notify(new DefaultError(body.error));

	return { enabled: body?.migrated ?? false, mergeData: body?.mergeData, patterns: body?.patterns };
};
