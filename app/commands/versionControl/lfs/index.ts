import applyWorkspaceLfsMigration from "./applyWorkspaceLfsMigration";
import checkWorkspaceLfsDivergence from "./checkWorkspaceLfsDivergence";
import enableAutoLfsAttachments from "./enableAutoLfsAttachments";
import getAttachmentsMigrationStats from "./getAttachmentsMigrationStats";
import getLfsOptions from "./getLfsOptions";
import getWorkspaceLfsMigrationStats from "./getWorkspaceLfsMigrationStats";
import updateLfsOptions from "./updateLfsOptions";

export default {
	getLfsOptions,
	updateLfsOptions,
	checkWorkspaceLfsDivergence,
	applyWorkspaceLfsMigration,
	getWorkspaceLfsMigrationStats,
	getAttachmentsMigrationStats,
	enableAutoLfsAttachments,
};
