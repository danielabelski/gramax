import type { AutoLfsProps } from "@core/GitLfs/logic/autoLfsAttachments";
import type { CatalogView } from "@ext/catalog/views/models/CatalogViews";
import type { RefInfo } from "@ext/git/core/GitCommands/model/GitCommandsModel";
import type { FSLocalizationProps } from "@ext/localization/core/events/FSLocalizationEvents";
import type { Syntax } from "@ext/markdown/core/edit/logic/Formatter/Formatters/typeFormats/model/Syntax";
import type { TitledLink } from "@ext/navigation/NavigationLinks";
import type { Property, PropertyID } from "@ext/properties/models";

export type CatalogProps = FSLocalizationProps & {
	title?: string;
	description?: string;
	url?: string;
	docroot?: string;
	contactEmail?: string;
	properties?: Property[];
	versions?: string[];
	filterProperty?: PropertyID;
	syntax?: Syntax;

	/** Automatic LFS for new attachments. Absent means the catalog predates the feature — treat as off. */
	lfs?: AutoLfsProps;

	relatedLinks?: TitledLink[];
	private?: string[];
	hidden?: boolean;
	refs?: string[];

	sharePointDirectory?: string;

	isCloning?: boolean;
	cloneCancelDisabled?: boolean;
	redirectOnClone?: string;
	resolvedView?: CatalogView;
	resolvedVersions?: RefInfo[];
	resolvedVersion?: RefInfo;
	optionalCategoryIndex?: boolean;

	logo?: string;
	logo_dark?: string;

	docrootIsNoneExistent?: boolean;

	isGitRepo?: boolean;
	isBareRepo?: boolean;
	hasGitmodules?: boolean;
};

export const normalizeCatalogProps = (props: CatalogProps): CatalogProps => {
	const normalizedProps = { ...props };
	const title = normalizedProps.title as unknown;

	if (typeof title === "number" || typeof title === "boolean") normalizedProps.title = String(title);
	else if (typeof title !== "string") delete normalizedProps.title;

	return normalizedProps;
};

export const ExcludedProps: (keyof CatalogProps)[] = [
	"url",
	"docroot",
	"docrootIsNoneExistent",
	"resolvedVersions",
	"resolvedVersion",
	"isCloning",
	"cloneCancelDisabled",
	"redirectOnClone",
	"resolvedView",
	// Detected while scanning, never authored: writing them back would put `isGitRepo: true` at the
	// top of the user's doc-root and commit it to their repository.
	"isGitRepo",
	"isBareRepo",
	"hasGitmodules",
];
