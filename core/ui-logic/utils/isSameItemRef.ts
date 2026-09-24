import type { ClientItemRef } from "@core/SitePresenter/SitePresenter";

/** An article is path + storage: paths repeat across workspaces, so path alone matches the wrong one. */
const isSameItemRef = (a: ClientItemRef, b: ClientItemRef) =>
	!!a && !!b && a.path === b.path && a.storageId === b.storageId;

export default isSameItemRef;
