import type { AppConfig } from "@app/config/AppConfig";
import resolveBackendModule from "@app/resolveModule/backend";
import { getExecutingEnvironment } from "@app/resolveModule/env";
import { span, traced } from "@ext/loggers/opentelemetry";
import type { CreateSearcherManagerArgs } from "@ext/serach/createSearcherManager";
import { createModulithFileProviders, createModulithService } from "@ext/serach/modulith/createModulithService";
import ModulithChatBotSearcher from "@ext/serach/modulith/ModulithChatBotSearcher";
import { ModulithSearcher } from "@ext/serach/modulith/ModulithSearcher";
import { RemoteSearchHealthchecker } from "@ext/serach/modulith/RemoteSearchHealthchecker";
import { SearchHealthchecker } from "@ext/serach/modulith/SearchHealthchecker";
import { RemoteModulithSearchClient } from "@ext/serach/modulith/search/RemoteModulithSearchClient";
import SearcherManager from "@ext/serach/SearcherManager";
import { UnavailableSearcher } from "@ext/serach/UnavailableSearcher";

export const createSearcherManager = async ({
	config,
	wm,
	parser,
	parserContextFactory,
	tablesManager,
	healthcheckRegistry,
}: CreateSearcherManagerArgs) => {
	const remote = await createRemoteClient(config);

	if (remote && getExecutingEnvironment() === "next") {
		if (!remote.serverAvailable) console.log("AI Server is not available");
		if (remote.serverAvailable && !remote.authAvailable) console.log("AI Token is invalid");
	}

	const aiAvailable = Boolean(remote?.serverAvailable && remote?.authAvailable);
	const chatBotSearcher = remote?.client ? new ModulithChatBotSearcher(remote.client, wm) : undefined;
	if (remote?.client && healthcheckRegistry) {
		healthcheckRegistry.register(new RemoteSearchHealthchecker(remote?.client));
	}

	return await traced("node-search-create", async () => {
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
				remoteClient: aiAvailable ? remote.client : undefined,
				immediateIndexing: true,
				diagramRendererServerUrl: (await wm.current()?.config())?.services?.diagramRenderer?.url,
				tablesManager,
				resourceSearchEnabled: config.search.resourceSearchEnabled,
			});
			healthcheckRegistry?.register(new SearchHealthchecker(() => modulithService.getSearchHealth()));

			return {
				aiAvailable,
				searcherManager: new SearcherManager(new ModulithSearcher(modulithService), chatBotSearcher),
			};
		} catch (error) {
			healthcheckRegistry?.register(new SearchHealthchecker(() => ({ phase: "failed" })));
			span()?.recordException(error instanceof Error ? error : new Error(String(error)));
			span()?.addEvent("disabled", { capability: "local-search" });
			return {
				aiAvailable,
				searcherManager: new SearcherManager(new UnavailableSearcher(error), chatBotSearcher),
			};
		}
	});
};

const createRemoteClient = async (config: AppConfig) => {
	if (!config.portalAi.enabled) return undefined;
	try {
		return await RemoteModulithSearchClient.create({
			apiUrl: config.portalAi.apiUrl,
			apiKey: config.portalAi.token,
			collectionName: config.portalAi.instanceName,
		});
	} catch (error) {
		span()?.recordException(error instanceof Error ? error : new Error(String(error)));
		return undefined;
	}
};
