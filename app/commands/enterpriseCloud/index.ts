import logout from "@app/commands/enterpriseCloud/logout";
import addWorkspace from "./addWorkspace";
import disableCloud from "./disableCloud";
import enableCloud from "./enableCloud";
import getCatalogRepositoryName from "./getCatalogRepositoryName";
import initNewCatalog from "./initNewCatalog";
import prepareNewCatalog from "./prepareNewCatalog";
import setGesCloudUrl from "./setGesCloudUrl";
import switchOrganization from "./switchOrganization";

const enterpriseCloud = {
	addWorkspace,
	getCatalogRepositoryName,
	prepareNewCatalog,
	initNewCatalog,
	disableCloud,
	enableCloud,
	logout,
	setGesCloudUrl,
	switchOrganization,
};

export default enterpriseCloud;
