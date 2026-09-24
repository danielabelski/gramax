import TagInputWithKeyboard from "@components/Atoms/TagInputWithKeyboard";
import { withDefaultLfsExclude } from "@core/GitLfs/logic/autoLfsAttachments";
import { configLfsPolicy, configManagesLfsPatterns } from "@core/GitLfs/logic/workspaceLfsPatterns";
import { DEFAULT_LFS_PATTERNS } from "@core/GitLfs/options";
import Workspace from "@core-ui/ContextServices/Workspace";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { SectionContainer } from "@ext/catalog/actions/propsEditor/components/Sections/SectionContainer";
import t from "@ext/localization/locale/translate";
import SectionHeader from "@ext/settings/components/SectionHeader";
import { useSetting } from "@ext/settings/logic/hooks";
import isGitSourceType from "@ext/storage/logic/SourceDataProvider/logic/isGitSourceType";
import getPartGitSourceDataByStorageName from "@ext/storage/logic/utils/getPartSourceDataByStorageName";
import { IconButton } from "@ui-kit/Button";
import { FormField } from "@ui-kit/Form";
import { Loader } from "@ui-kit/Loader";
import { SwitchField } from "@ui-kit/Switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import React, { type ReactNode, useMemo } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { FormData, FormProps } from "../../logic/createFormSchema";

/** The «Подробнее» link both lists carry — one page describes the masks and the exclusions alike. */
const DocsLink = ({ language }: { language: string }) => (
	<a
		className="pl-1 !text-[color:var(--color-link)]"
		href={
			language === "ru"
				? "https://gram.ax/resources/docs/storage/git-lfs"
				: "https://gram.ax/resources/docs/en/storage/git-lfs"
		}
		rel="noopener noreferrer"
		target="_blank"
	>
		{t("more")}
	</a>
);

/**
 * A tag list with its buttons beside it.
 *
 * `FormField` renders the control through a Radix Slot, which clones the field's `id` and
 * `aria-describedby` onto whatever single element the control returns. A plain positioning div would
 * keep them for itself — the `<label for>` would name the div, and the input would have no accessible
 * name at all — so this one hands them down to the list, the way the ui-kit's own wrapper does.
 */
const ListWithActions = React.forwardRef<HTMLElement, { actions?: ReactNode; children: ReactNode }>(
	({ actions, children, ...props }, ref) => {
		const child = React.Children.only(children);
		const wired = React.isValidElement(child)
			? React.cloneElement(
					child as React.ReactElement,
					{
						...props,
						...(ref ? { ref } : {}),
					} as React.Attributes,
				)
			: child;

		return (
			<div className="flex w-full items-start gap-1">
				<div className="min-w-0 flex-1">{wired}</div>
				{/* The list is a column — input, tags, description — so centring against the whole of it
				    would drift with the tags. The buttons take the input's own height instead and centre
				    in that, which keeps them on its axis at either breakpoint. */}
				{actions && <div className="flex h-10 items-center lg:h-9">{actions}</div>}
			</div>
		);
	},
);
ListWithActions.displayName = "ListWithActions";

/** A button beside a tag list. */
const ListAction = ({
	icon,
	onClick,
	tooltip,
}: {
	icon: "stamp" | "trash";
	onClick: () => void;
	tooltip: ReactNode;
}) => (
	<Tooltip>
		<TooltipTrigger>
			<IconButton
				className="p-0"
				icon={icon}
				onClick={(ev) => {
					ev.preventDefault();
					onClick();
				}}
				size="sm"
				type="button"
				variant="text"
			/>
		</TooltipTrigger>
		<TooltipContent>{tooltip}</TooltipContent>
	</Tooltip>
);

export type LfsProps = {
	form: UseFormReturn<FormData>;
	formProps: FormProps;
	onToggleAutoLfs?: (next: boolean) => void;
	/** The enable is being checked — until it answers, nobody knows whether it needs confirming. */
	autoLfsChecking?: boolean;
	/** Whether the catalog's LFS state was read. Enabling on an unread state would not persist. */
	lfsKnown?: boolean;
};

export const EditLfsProps = ({ form, formProps, onToggleAutoLfs, autoLfsChecking, lfsKnown = true }: LfsProps) => {
	const sourceName = useCatalogPropsStore((state) => state.data?.sourceName);
	const { sourceType } = getPartGitSourceDataByStorageName(sourceName);
	const workspace = Workspace.current();
	const hasWorkspaceDefinedPatterns = configManagesLfsPatterns(workspace);
	// What an administered workspace imposes on every catalog under it. Nothing imposed is the
	// ordinary case, and the only one: a workspace turns the auto-add on for everyone or says nothing.
	const policy = configLfsPolicy(workspace);
	const [language] = useSetting("general.language");
	const workspaceDecides = !!policy.auto;
	const lfsOptionsReadonly = !isGitSourceType(sourceType);
	const readonly = lfsOptionsReadonly || hasWorkspaceDefinedPatterns;
	const stored = !!useWatch({ control: form.control, name: "lfs.auto" });
	const lazy = !!useWatch({ control: form.control, name: "lfs.lazy" });
	// A workspace that turned the auto-add on is the answer. Otherwise a workspace that syncs its own
	// masks makes the auto-add inert whatever the doc-root still stores, so the switch reads off there
	// — and the exclusions it owns go with it, having nothing left to exclude from.
	const auto = workspaceDecides || (stored && !hasWorkspaceDefinedPatterns);
	// What holds here without this catalog having asked for it: the defaults, plus whatever the
	// workspace excludes. Shown in the list, because a list that hid them would read as a list that
	// does not apply them — and not removable, because neither is this catalog's to drop.
	const lockedExclude = useMemo(() => withDefaultLfsExclude(policy.exclude ?? []), [policy.exclude]);

	return (
		<SectionContainer header={<SectionHeader title={t("forms.catalog-edit-props.tabs.lfs")} />}>
			<SwitchField
				alignment="left"
				checked={auto}
				description={t("forms.catalog-edit-props.props.lfs.auto.description")}
				// Until the check answers, nobody knows whether this needs confirming — so a second click cannot help.
				disabled={readonly || workspaceDecides || autoLfsChecking || !lfsKnown}
				label={
					<span className="flex items-center gap-1.5">
						{t("forms.catalog-edit-props.props.lfs.auto.name")}
						{autoLfsChecking && <Loader className="px-0 text-muted-foreground" size="sm" />}
					</span>
				}
				onCheckedChange={(next) => {
					if (onToggleAutoLfs) return onToggleAutoLfs(next);
					form.setValue("lfs.auto", next, { shouldDirty: true });
				}}
				size="sm"
			/>
			<SwitchField
				alignment="left"
				checked={!lazy}
				description={<span>{t("forms.catalog-edit-props.props.lfs.lazy.description")}</span>}
				disabled={lfsOptionsReadonly || !lfsKnown}
				label={<span>{t("forms.catalog-edit-props.props.lfs.lazy.name")}</span>}
				onCheckedChange={(next) => form.setValue("lfs.lazy", !next, { shouldDirty: true })}
				size="sm"
			/>

			{auto && (
				<FormField
					{...formProps}
					control={({ field }) => (
						<ListWithActions
							actions={
								!readonly && (
									// No «restore defaults» twin to the masks' one: the defaults here cannot be
									// removed in the first place, so there is nothing for such a button to bring back.
									<ListAction
										icon="trash"
										onClick={() => form.setValue("lfs.exclude", [], { shouldDirty: true })}
										tooltip={t("clear")}
									/>
								)
							}
						>
							<TagInputWithKeyboard
								lockedValues={lockedExclude}
								onChange={(values) => field.onChange(values)}
								placeholder={t("forms.catalog-edit-props.props.lfs.exclude.placeholder")}
								readonly={readonly}
								value={field.value || []}
							/>
						</ListWithActions>
					)}
					description={
						<>
							{t("forms.catalog-edit-props.props.lfs.exclude.description")}
							<DocsLink language={language} />
						</>
					}
					labelClassName="w-full"
					layout="vertical"
					name="lfs.exclude"
					title={t("forms.catalog-edit-props.props.lfs.exclude.name")}
				/>
			)}

			{/* The masks are what the auto-add maintains on its own; showing the list while it does would
			    invite an edit that the next attachment overwrites. Turned off, the catalog is masks alone. */}
			{!auto && (
				<FormField
					{...formProps}
					control={({ field }) => (
						<ListWithActions
							actions={
								!readonly && (
									<>
										<ListAction
											icon="stamp"
											onClick={() => form.setValue("lfs.patterns", DEFAULT_LFS_PATTERNS)}
											tooltip={t("forms.catalog-edit-props.props.lfs.patterns.default-tooltip")}
										/>
										<ListAction
											icon="trash"
											onClick={() => form.setValue("lfs.patterns", [])}
											tooltip={t("clear")}
										/>
									</>
								)
							}
						>
							<TagInputWithKeyboard
								onChange={(values) => field.onChange(values)}
								placeholder={t("forms.catalog-edit-props.props.lfs.patterns.placeholder")}
								readonly={readonly}
								value={field.value || []}
							/>
						</ListWithActions>
					)}
					description={
						<>
							{t("forms.catalog-edit-props.props.lfs.patterns.description")}
							<DocsLink language={language} />
						</>
					}
					labelClassName="w-full"
					layout="vertical"
					name="lfs.patterns"
					title={t("forms.catalog-edit-props.props.lfs.patterns.name")}
				/>
			)}
		</SectionContainer>
	);
};
