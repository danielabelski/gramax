import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { GesCloudConnectStorage } from "@ext/enterprise-cloud/components/Catalog/ConnectStorage";
import useHasRemoteStorage from "@ext/storage/logic/utils/useHasRemoteStorage";
import InitSource from "../../storage/components/InitSource";
import InitStorage from "../../storage/components/InitStorage";

const DefaultConnectStorage = ({ trigger }: { trigger: JSX.Element }) => {
	const hasRemoteStorage = useHasRemoteStorage();
	return hasRemoteStorage ? <InitSource trigger={trigger} /> : <InitStorage trigger={trigger} />;
};

const ConnectStorage = ({ trigger }: { trigger: JSX.Element }) => {
	const { url: gesCloudUrl, enabled: cloudEnabled } = PageDataContextService.value.conf.enterpriseCloud;
	if (gesCloudUrl && cloudEnabled) return <GesCloudConnectStorage trigger={trigger} />;
	return <DefaultConnectStorage trigger={trigger} />;
};

export default ConnectStorage;
