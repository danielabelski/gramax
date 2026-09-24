import type { AttachmentsMigrationStats } from "@app/commands/versionControl/lfs/getAttachmentsMigrationStats";
import DiffContent from "@components/Atoms/DiffContent";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import { formatBytes } from "@core-ui/utils/formatBytes";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import { requestEnableAutoLfsAttachments } from "@ext/git/actions/Sync/logic/autoLfsAttachmentsRequests";
import t from "@ext/localization/locale/translate";
import type { DiffHunk } from "@ext/VersionControl/DiffHandler/model/DiffHunk";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { AlertProgressConfirm } from "@ui-kit/AlertDialog";
import { diffLines } from "diff";
import { type ReactNode, useState } from "react";

const toLineHunks = ({ before, after }: { before: string; after: string }): DiffHunk[] =>
	diffLines(before, after).map((c) => ({
		value: c.value,
		type: c.added ? FileStatus.new : c.removed ? FileStatus.delete : undefined,
	}));

const patternList = (patterns: string[]): ReactNode =>
	patterns.map((pattern, i) => (
		<span key={pattern}>
			{i > 0 && ", "}
			<code data-component="code">{pattern}</code>
		</span>
	));

const AffectedSummary = ({ stats }: { stats: AttachmentsMigrationStats }) => {
	if (!stats.fileCount) return null;

	const [head, rest] = t("git.lfs-auto-attachments.alert.affected").split("{count}");
	const [middle, tail] = (rest ?? "").split("{size}");

	return (
		<p className="font-medium">
			{head}
			{String(stats.fileCount)}
			{middle}
			{formatBytes(stats.totalSize, 1)}
			{tail}
		</p>
	);
};

const DetailsAttributes = ({ added }: { added: string[] }) => {
	const [lead, tail] = t("git.lfs-auto-attachments.alert.details-lead").split("{file}");

	return (
		<p className="break-words">
			{lead}
			<code data-component="code">.gitattributes</code>
			{tail}
			{t("git.lfs-auto-attachments.alert.details-added")} {patternList(added)}.
		</p>
	);
};

export interface LfsAutoAttachmentsDialogProps {
	apiUrlCreator: ApiUrlCreator;
	/** Exclusions as they stand in the form right now — the migration must see the pending edits. */
	exclude: string[];
	/** What the enable would do, already checked by the caller — reused here rather than re-fetched. */
	stats: AttachmentsMigrationStats;
	/**
	 * `true` only when the command actually saved the setting; `false` on any failure or dismissal.
	 * `patterns` is the mask list `.gitattributes` ends up with, so the form behind this dialog can
	 * replace the copy it read at mount instead of saving a pre-migration one back over it.
	 */
	onSettled: (enabled: boolean, mergeData?: MergeData, patterns?: string[]) => void;
}

const LfsAutoAttachmentsDialog = ({ apiUrlCreator, exclude, stats, onSettled }: LfsAutoAttachmentsDialogProps) => {
	const [open, setOpen] = useState(true);
	const [migrating, setMigrating] = useState(false);

	const handleDismiss = () => {
		if (migrating) return;
		setOpen(false);
		onSettled(false);
	};

	const handleMigrate = async () => {
		setMigrating(true);
		try {
			const { enabled, mergeData, patterns } = await requestEnableAutoLfsAttachments(apiUrlCreator, exclude);
			onSettled(enabled, mergeData, patterns);
		} catch (e) {
			// A network-level throw lands here instead of a non-ok response; without this `migrating` stays
			// true and the dialog becomes undismissible. Settle as a failure, then re-throw for global handlers.
			setMigrating(false);
			onSettled(false);
			throw e;
		}
	};

	return (
		<AlertProgressConfirm
			cancelText={t("git.lfs-auto-attachments.alert.cancel")}
			confirmText={t("git.lfs-auto-attachments.alert.migrate")}
			description={
				<>
					<p>{t("git.lfs-auto-attachments.alert.body")}</p>
					<AffectedSummary stats={stats} />
				</>
			}
			details={
				!!stats.added.length && (
					<>
						<DetailsAttributes added={stats.added} />
						{stats.fileDiff && (
							<section
								aria-label=".gitattributes"
								className="max-h-64 overflow-auto rounded-md border p-2"
							>
								<DiffContent changes={toLineHunks(stats.fileDiff)} isCode showDiff />
							</section>
						)}
					</>
				)
			}
			detailsText={t("git.lfs-auto-attachments.alert.details-trigger")}
			icon="cloud-upload"
			onCancel={handleDismiss}
			onConfirm={handleMigrate}
			open={open}
			running={migrating}
			title={t(`git.lfs-auto-attachments.alert.${migrating ? "migrating" : "title"}`)}
		/>
	);
};

export default LfsAutoAttachmentsDialog;
