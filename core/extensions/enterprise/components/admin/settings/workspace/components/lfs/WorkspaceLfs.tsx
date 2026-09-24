import TagInputWithKeyboard from "@components/Atoms/TagInputWithKeyboard";
import LfsPatternsEditor from "@core/GitLfs/components/LfsPatternsEditor";
import { customLfsExclude, DEFAULT_LFS_EXCLUDE } from "@core/GitLfs/logic/autoLfsAttachments";
import { SettingsSection } from "@ext/enterprise/components/admin/ui-kit/SettingsSection";
import t from "@ext/localization/locale/translate";
import type { WorkspaceLfsConfig } from "@ext/workspace/WorkspaceConfig";
import { SwitchField } from "@ui-kit/Switch";
import { useCallback } from "react";
import { withLfsChange } from "../../model/workspaceLfsSettings";
import type { WorkspaceSettings } from "../../types/WorkspaceComponent";

interface WorkspaceLfsProps {
	localSettings: WorkspaceSettings;
	setLocalSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
}

export function WorkspaceLfs({ localSettings, setLocalSettings }: WorkspaceLfsProps) {
	const lfs = localSettings.git?.lfs;

	// One writer for the whole block, so setting any of the three cannot drop the other two.
	const updateLfs = useCallback(
		(changed: Partial<WorkspaceLfsConfig>) => {
			setLocalSettings((prev) => ({
				...prev,
				git: { ...prev.git, lfs: withLfsChange(prev.git?.lfs, changed) },
			}));
		},
		[setLocalSettings],
	);

	return (
		<SettingsSection contentClassName="space-y-4" title={t("workspace.lfs-section-title")}>
			{/* The policy every catalog under this workspace obeys: its own switch reads this value and
			    is not editable there. The masks below are a separate matter — those the workspace syncs. */}
			<SwitchField
				alignment="left"
				checked={lfs?.auto ?? false}
				description={t("forms.catalog-edit-props.props.lfs.auto.description")}
				label={t("forms.catalog-edit-props.props.lfs.auto.name")}
				onCheckedChange={(next) => updateLfs({ auto: next })}
				size="sm"
			/>

			{/* Shown whether or not the switch above is on: leaving it off imposes nothing, so catalogs
			    may still turn the auto-add on themselves — and these exclusions reach them too. */}
			{lfs?.auto && (
				<div className="flex w-full flex-col gap-1">
					<span className="text-sm font-medium">{t("forms.catalog-edit-props.props.lfs.exclude.name")}</span>
					<TagInputWithKeyboard
						description={t("forms.catalog-edit-props.props.lfs.exclude.description")}
						// Locked here for the same reason the catalog locks them: they hold either way, and
						// a list that hid them would read as a list that does not apply them.
						lockedValues={DEFAULT_LFS_EXCLUDE}
						onChange={(values) => updateLfs({ exclude: values })}
						placeholder={t("forms.catalog-edit-props.props.lfs.exclude.placeholder")}
						value={customLfsExclude(lfs?.exclude)}
					/>
				</div>
			)}

			{!lfs?.auto && (
				<LfsPatternsEditor
					description={t("workspace.lfs-section-description")}
					onChange={(values) => updateLfs({ patterns: values })}
					value={lfs?.patterns ?? []}
				/>
			)}
		</SettingsSection>
	);
}
