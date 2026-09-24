import type { AppConfig } from "@app/config/AppConfig";
import { STORAGE_DIR_NAME } from "@app/config/const";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { AgentBrowserHost } from "../browser/browserHost";
import { createAgentBrowserHost } from "../browser/createAgentBrowserHost";
import { AgentLlmClient, type AgentLlmEndpoint } from "../llm";
import { AgentSecretStore } from "../mcp/agentSecretStore";
import { AgentToolRegistry } from "../mcp/registry";
import { AgentFileStore } from "./agentFileStore";
import { AgentAttachmentStore } from "./attachmentStore";
import { AgentSessionStore } from "./sessionStore";

const migration = async (rootPath: Path, oldPath: Path, newPath: Path) => {
	const fp = new DiskFileProvider(rootPath);
	const targetPath = rootPath.join(newPath);

	if (await fp.exists(newPath)) return rootPath.join(newPath);
	if (await fp.exists(oldPath)) await fp.move(oldPath, newPath);

	return targetPath;
};

export default class AgentManager {
	readonly fileStore: AgentFileStore;
	readonly sessions: AgentSessionStore;
	readonly secrets: AgentSecretStore;
	readonly attachments: AgentAttachmentStore;
	readonly toolRegistry: AgentToolRegistry;
	readonly browserHost: AgentBrowserHost;
	browserAllowed = false;

	private constructor(config: AppConfig, agentDataPath: Path) {
		this.fileStore = new AgentFileStore(agentDataPath);
		this.sessions = new AgentSessionStore(this.fileStore);
		this.secrets = new AgentSecretStore(config);
		this.attachments = new AgentAttachmentStore(this.fileStore);
		this.toolRegistry = new AgentToolRegistry();
		this.browserHost = createAgentBrowserHost();
	}

	static async create(config: AppConfig): Promise<AgentManager> {
		const rootPath = config.paths.data;
		const oldAgentDataPath = new Path(`agent`);
		const newAgentDataPath = new Path(`${STORAGE_DIR_NAME}/.agent`);
		const agentDataPath = await migration(rootPath, oldAgentDataPath, newAgentDataPath);

		return new AgentManager(config, agentDataPath);
	}

	getLlmClient(endpoint: AgentLlmEndpoint): AgentLlmClient {
		return AgentLlmClient.create(endpoint);
	}
}
