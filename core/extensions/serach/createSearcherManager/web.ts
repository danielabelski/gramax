import type { AppConfig } from "@app/config/AppConfig";
import resolveBackendModule from "@app/resolveModule/backend";
import { getExecutingEnvironment } from "@app/resolveModule/env";
import { span, traced } from "@ext/loggers/opentelemetry";
import type { CreateSearcherManagerArgs } from "@ext/serach/createSearcherManager";
import { createModulithFileProviders, createModulithService } from "@ext/serach/modulith/createModulithService";
import ModulithChatBotSearcher from "@ext/serach/modulith/ModulithChatBotSearcher";
import { ModulithSearcher } from "@ext/serach/modulith/ModulithSearcher";
import { RemoteModulithSearchClient } from "@ext/serach/modulith/search/RemoteModulithSearchClient";
import SearcherManager from "@ext/serach/SearcherManager";
import { UnavailableSearcher } from "@ext/serach/UnavailableSearcher";

export const createSearcherManager = async ({
	parser,
	parserContextFactory,
	wm,
	config,
	tablesManager,
}: CreateSearcherManagerArgs) => {
	const remoteModulithClient = await createRemoteClient(config);
	const chatBotSearcher = remoteModulithClient ? new ModulithChatBotSearcher(remoteModulithClient, wm) : undefined;

	return await traced("web-search-create", async () => {
		try {
			const localClient = await resolveBackendModule("getModulithSearchClient")(
				createModulithFileProviders(config.paths.data),
			);
			const resourceParseClient = await resolveBackendModule("getResourceParseClient")();
			const modulithService = await createModulithService({
				wm,
				parser,
				parserContextFactory,
				resourceParseClient,
				localClient,
				diagramRendererServerUrl: (await wm.maybeCurrent()?.config())?.services?.diagramRenderer?.url,
				tablesManager,
				resourceSearchEnabled: config.search.resourceSearchEnabled,
			});

			return new SearcherManager(new ModulithSearcher(modulithService), chatBotSearcher);
		} catch (error) {
			span()?.recordException(error instanceof Error ? error : new Error(String(error)));
			span()?.addEvent("disabled", { capability: "local-search" });
			return new SearcherManager(new UnavailableSearcher(error), chatBotSearcher);
		}
	});
};

const createRemoteClient = async (config: AppConfig) => {
	if (getExecutingEnvironment() !== "static" || !config.portalAi.enabled) return undefined;
	try {
		const remote = await RemoteModulithSearchClient.create({
			apiUrl: config.portalAi.apiUrl,
			apiKey: config.portalAi.token,
			collectionName: config.portalAi.instanceName,
		});

		return remote.authAvailable && remote.serverAvailable ? remote.client : undefined;
	} catch (error) {
		span()?.recordException(error instanceof Error ? error : new Error(String(error)));
		return undefined;
	}
};
