import type { CommandTree } from "@app/commands";
import { getExecutingEnvironment } from "@app/resolveModule/env";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import { agentBrowserConfig } from "../browser/config";
import type { AgentLlmClient } from "../llm/agentLlmClient";
import { getToolsDescriptions } from "../prompts";
import { type AgentToolCallPolicy, allowAllAgentToolCallPolicy } from "./policy";
import { fail, type ToolDefinition, type ToolExecutionContext, type ToolExecutionResult } from "./tool";
import { runBrowserClick } from "./tools/browserClick";
import { runBrowserNavigate } from "./tools/browserNavigate";
import { runBrowserReadElement } from "./tools/browserReadElement";
import { runBrowserReadPage } from "./tools/browserReadPage";
import { runBrowserScroll } from "./tools/browserScroll";
import { runBrowserType } from "./tools/browserType";
import { runSearchWeb } from "./tools/browserWebSearch";
import { runCompactContext } from "./tools/compactContext";
import { runCreateCatalogItem } from "./tools/createCatalogItem";
import { runDeleteCatalogItem } from "./tools/deleteCatalogItem";
import { runGetCatalogItemHeadings } from "./tools/getCatalogItemHeadings";
import { runGetFilesNavigation } from "./tools/getFilesNavigation";
import { runGetNavigation } from "./tools/getNavigation";
import { runGitBranch } from "./tools/gitBranch";
import { runGitDiscard } from "./tools/gitDiscard";
import { runGitInspect } from "./tools/gitInspect";
import { runGitRestore } from "./tools/gitRestore";
import { HTTP_METHODS, runHttpRequest } from "./tools/httpRequest";
import { runListCatalogs } from "./tools/listCatalogs";
import { runMailRequest } from "./tools/mailRequest";
import { runMoveCatalogItem } from "./tools/moveCatalogItem";
import { runReadCatalogItem } from "./tools/readCatalogItem";
import { runReadDocument } from "./tools/readDocument";
import { runReadFile } from "./tools/readFile";
import { runReplaceCatalogItem } from "./tools/replaceCatalogItem";
import { runSaveChatAttachment } from "./tools/saveChatAttachment";
import { runSearchCatalogs } from "./tools/searchCatalogs";
import { runSearchFiles } from "./tools/searchFiles";
import { runTranscribeAudio } from "./tools/transcribeAudio";
import { runWriteCatalogItem } from "./tools/writeCatalogItem";

export class AgentToolRegistry {
	readonly tools: ToolDefinition[];
	readonly policy: AgentToolCallPolicy;
	private readonly _toolsWithSecretResolving = new Set(["http_request", "mail_request"]);

	constructor() {
		this.policy = allowAllAgentToolCallPolicy;
		this.tools = this._createTools();
	}

	getTools(app: Application): ToolDefinition[] {
		const browserAllowed = !!app.agentManager.browserAllowed;
		return this._createTools(getToolsDescriptions()).filter((tool) => {
			if ((tool.name.startsWith("browser_") || tool.name === "search_web") && !browserAllowed) return false;
			if (tool.name === "search_web" && !agentBrowserConfig.provider.trim()) return false;
			return true;
		});
	}

	async executeTool(
		name: string,
		input: unknown,
		app: Application,
		ctx: Context,
		commands: CommandTree,
		sessionId?: string,
		llmClient?: AgentLlmClient,
		onUsage?: ToolExecutionContext["onUsage"],
	): Promise<ToolExecutionResult> {
		const session = sessionId ? app.agentManager.sessions.get(sessionId) : null;
		const tool = this.tools.find((tool) => tool.name === name);
		if (!tool) {
			return fail(`Unknown tool name: ${name}`);
		}
		if ((tool.name.startsWith("browser_") || tool.name === "search_web") && !app.agentManager.browserAllowed) {
			return fail("Browser tools are disabled for this message");
		}
		if (tool.name === "search_web" && !agentBrowserConfig.provider.trim()) {
			return fail("Web search tool is disabled: provider is not configured");
		}
		let toolInput = input;
		if (this._toolsWithSecretResolving.has(tool.name)) {
			const resolved = app.agentManager.secrets.resolve(JSON.stringify(input));
			if (resolved.missing.length) {
				return fail(`Missing secret: ${resolved.missing.join(", ")}`, { secrets: resolved.missing });
			}
			toolInput = JSON.parse(resolved.text);
		}
		const result = await tool.execute({
			input: toolInput,
			app,
			ctx,
			commands,
			sessionId,
			openCatalogName: session?.openCatalogName ?? undefined,
			openItemPath: session?.openItemPath ?? undefined,
			llmClient,
			onUsage,
		});
		if (this._toolsWithSecretResolving.has(tool.name)) {
			return JSON.parse(app.agentManager.secrets.unresolve(JSON.stringify(result)));
		}
		return result;
	}

	private _createTools(docs = getToolsDescriptions()): ToolDefinition[] {
		const tools: ToolDefinition[] = [
			{
				name: "browser_navigate",
				description: docs.browserNavigate.description,
				inputSchema: {
					type: "object",
					properties: {
						url: { type: "string", description: docs.browserNavigate.input.url },
					},
					required: ["url"],
					additionalProperties: false,
				},
				async execute(context) {
					return runBrowserNavigate(context);
				},
			},
			{
				name: "browser_read_page",
				description: docs.browserReadPage.description,
				inputSchema: { type: "object", properties: {}, additionalProperties: false },
				async execute(context) {
					return runBrowserReadPage(context);
				},
			},
			{
				name: "browser_read_element",
				description: docs.browserReadElement.description,
				inputSchema: {
					type: "object",
					properties: {
						elementId: { type: "string", description: docs.browserReadElement.input.elementId },
					},
					required: ["elementId"],
					additionalProperties: false,
				},
				async execute(context) {
					return runBrowserReadElement(context);
				},
			},
			{
				name: "browser_click",
				description: docs.browserClick.description,
				inputSchema: {
					type: "object",
					properties: {
						elementId: { type: "string", description: docs.browserClick.input.elementId },
					},
					required: ["elementId"],
					additionalProperties: false,
				},
				async execute(context) {
					return runBrowserClick(context);
				},
			},
			{
				name: "browser_type",
				description: docs.browserType.description,
				inputSchema: {
					type: "object",
					properties: {
						elementId: { type: "string", description: docs.browserType.input.elementId },
						text: { type: "string", description: docs.browserType.input.text },
					},
					required: ["elementId", "text"],
					additionalProperties: false,
				},
				async execute(context) {
					return runBrowserType(context);
				},
			},
			{
				name: "browser_scroll",
				description: docs.browserScroll.description,
				inputSchema: { type: "object", properties: {}, additionalProperties: false },
				async execute(context) {
					return runBrowserScroll(context);
				},
			},
			{
				name: "read_document",
				description: docs.readDocument.description,
				inputSchema: {
					type: "object",
					properties: {
						attachmentItemPath: {
							type: "string",
							description: docs.readDocument.input.attachmentItemPath,
						},
						headingId: {
							type: "string",
							description: docs.readDocument.input.headingId,
						},
					},
					required: ["attachmentItemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runReadDocument(context);
				},
			},
			{
				name: "list_catalogs",
				description: docs.listCatalogs.description,
				inputSchema: { type: "object", properties: {}, additionalProperties: false },
				async execute(context) {
					return runListCatalogs(context);
				},
			},
			{
				name: "read_catalog_item",
				description: docs.readCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.readCatalogItem.input.catalogName },
						itemPath: { type: "string", description: docs.readCatalogItem.input.itemPath },
						headingId: { type: "string", description: docs.readCatalogItem.input.headingId },
					},
					required: ["catalogName", "itemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runReadCatalogItem(context);
				},
			},
			{
				name: "get_catalog_item_headings",
				description: docs.getCatalogItemHeadings.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.getCatalogItemHeadings.input.catalogName },
						itemPath: { type: "string", description: docs.getCatalogItemHeadings.input.itemPath },
					},
					required: ["catalogName", "itemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGetCatalogItemHeadings(context);
				},
			},
			{
				name: "search_catalogs",
				description: docs.searchCatalogs.description,
				inputSchema: {
					type: "object",
					properties: {
						query: { type: "string", description: docs.searchCatalogs.input.query },
						catalogName: { type: "string", description: docs.searchCatalogs.input.catalogName },
					},
					required: ["query"],
					additionalProperties: false,
				},
				async execute(context) {
					return runSearchCatalogs(context);
				},
			},
			{
				name: "get_navigation",
				description: docs.getNavigation.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.getNavigation.input.catalogName },
						itemPath: { type: "string", description: docs.getNavigation.input.itemPath },
					},
					required: ["catalogName"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGetNavigation(context);
				},
			},
			{
				name: "delete_catalog_item",
				description: docs.deleteCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.deleteCatalogItem.input.catalogName },
						itemPath: { type: "string", description: docs.deleteCatalogItem.input.itemPath },
					},
					required: ["catalogName", "itemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runDeleteCatalogItem(context);
				},
			},
			{
				name: "move_catalog_item",
				description: docs.moveCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.moveCatalogItem.input.catalogName },
						fromItemPath: { type: "string", description: docs.moveCatalogItem.input.fromItemPath },
						toItemPath: { type: "string", description: docs.moveCatalogItem.input.toItemPath },
					},
					required: ["catalogName", "fromItemPath", "toItemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runMoveCatalogItem(context);
				},
			},
			{
				name: "create_catalog_item",
				description: docs.createCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.createCatalogItem.input.catalogName },
						itemPath: { type: "string", description: docs.createCatalogItem.input.itemPath },
						title: { type: "string", description: docs.createCatalogItem.input.title },
					},
					required: ["catalogName", "itemPath", "title"],
					additionalProperties: false,
				},
				async execute(context) {
					return runCreateCatalogItem(context);
				},
			},
			{
				name: "write_catalog_item",
				description: docs.writeCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.writeCatalogItem.input.catalogName },
						itemPath: { type: "string", description: docs.writeCatalogItem.input.itemPath },
						content: { type: "string", description: docs.writeCatalogItem.input.content },
						headingId: { type: "string", description: docs.writeCatalogItem.input.headingId },
					},
					required: ["catalogName", "itemPath", "content"],
					additionalProperties: false,
				},
				async execute(context) {
					return runWriteCatalogItem(context);
				},
			},
			{
				name: "replace_catalog_item",
				description: docs.replaceCatalogItem.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.replaceCatalogItem.input.catalogName },
						itemPath: { type: "string", description: docs.replaceCatalogItem.input.itemPath },
						oldContent: { type: "string", description: docs.replaceCatalogItem.input.oldContent },
						newContent: { type: "string", description: docs.replaceCatalogItem.input.newContent },
						replaceAll: { type: "boolean", description: docs.replaceCatalogItem.input.replaceAll },
					},
					required: ["catalogName", "itemPath", "oldContent", "newContent", "replaceAll"],
					additionalProperties: false,
				},
				async execute(context) {
					return runReplaceCatalogItem(context);
				},
			},
			{
				name: "save_chat_attachment",
				description: docs.saveChatAttachment.description,
				inputSchema: {
					type: "object",
					properties: {
						attachmentItemPath: {
							type: "string",
							description: docs.saveChatAttachment.input.attachmentItemPath,
						},
						catalogName: { type: "string", description: docs.saveChatAttachment.input.catalogName },
						targetItemPath: { type: "string", description: docs.saveChatAttachment.input.targetItemPath },
					},
					required: ["attachmentItemPath", "catalogName", "targetItemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runSaveChatAttachment(context);
				},
			},
			{
				name: "get_files_navigation",
				description: docs.getFilesNavigation.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.getFilesNavigation.input.catalogName },
						dirPath: { type: "string", description: docs.getFilesNavigation.input.dirPath },
					},
					required: ["catalogName"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGetFilesNavigation(context);
				},
			},
			{
				name: "search_files",
				description: docs.searchFiles.description,
				inputSchema: {
					type: "object",
					properties: {
						query: { type: "string", description: docs.searchFiles.input.query },
						catalogName: { type: "string", description: docs.searchFiles.input.catalogName },
					},
					required: ["query", "catalogName"],
					additionalProperties: false,
				},
				async execute(context) {
					return runSearchFiles(context);
				},
			},
			{
				name: "read_file",
				description: docs.readFile.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.readFile.input.catalogName },
						filePath: { type: "string", description: docs.readFile.input.filePath },
						headingId: { type: "string", description: docs.readFile.input.headingId },
					},
					required: ["catalogName", "filePath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runReadFile(context);
				},
			},
			{
				name: "git_inspect",
				description: docs.gitInspect.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.gitInspect.input.catalogName },
						action: {
							type: "string",
							enum: ["status", "log", "diff"],
							description: docs.gitInspect.input.action,
						},
						filePath: { type: "string", description: docs.gitInspect.input.filePath },
						limit: { type: "number", description: docs.gitInspect.input.limit },
						from: { type: "string", description: docs.gitInspect.input.from },
						to: { type: "string", description: docs.gitInspect.input.to },
					},
					required: ["catalogName", "action"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGitInspect(context);
				},
			},
			{
				name: "git_discard",
				description: docs.gitDiscard.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.gitDiscard.input.catalogName },
						filePaths: {
							type: "array",
							items: { type: "string" },
							description: docs.gitDiscard.input.filePaths,
						},
					},
					required: ["catalogName"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGitDiscard(context);
				},
			},
			{
				name: "git_branch",
				description: docs.gitBranch.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.gitBranch.input.catalogName },
						action: {
							type: "string",
							enum: ["branches", "checkout"],
							description: docs.gitBranch.input.action,
						},
						branch: { type: "string", description: docs.gitBranch.input.branch },
					},
					required: ["catalogName", "action"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGitBranch(context);
				},
			},
			{
				name: "git_restore",
				description: docs.gitRestore.description,
				inputSchema: {
					type: "object",
					properties: {
						catalogName: { type: "string", description: docs.gitRestore.input.catalogName },
						from: { type: "string", description: docs.gitRestore.input.from },
						filePaths: {
							type: "array",
							items: { type: "string" },
							description: docs.gitRestore.input.filePaths,
						},
					},
					required: ["catalogName", "from"],
					additionalProperties: false,
				},
				async execute(context) {
					return runGitRestore(context);
				},
			},
			{
				name: "http_request",
				description: docs.httpRequest.description,
				inputSchema: {
					type: "object",
					properties: {
						url: { type: "string", description: docs.httpRequest.input.url },
						method: {
							type: "string",
							enum: HTTP_METHODS,
							description: docs.httpRequest.input.method,
						},
						headers: {
							type: "object",
							additionalProperties: { type: "string" },
							description: docs.httpRequest.input.headers,
						},
						body: { type: "string", description: docs.httpRequest.input.body },
						auth: { type: "object", description: docs.httpRequest.input.auth },
					},
					required: ["url"],
					additionalProperties: false,
				},
				async execute(context) {
					return runHttpRequest(context);
				},
			},
			{
				name: "mail_request",
				description: docs.mailRequest.description,
				inputSchema: {
					type: "object",
					properties: {
						url: { type: "string", description: docs.mailRequest.input.url },
						command: { type: "string", description: docs.mailRequest.input.command },
						body: { type: "string", description: docs.mailRequest.input.body },
						auth: { type: "object", description: docs.mailRequest.input.auth },
					},
					required: ["url"],
					additionalProperties: false,
				},
				async execute(context) {
					return runMailRequest(context);
				},
			},
			{
				name: "transcribe_audio",
				description: docs.transcribeAudio.description,
				inputSchema: {
					type: "object",
					properties: {
						attachmentItemPath: {
							type: "string",
							description: docs.transcribeAudio.input.attachmentItemPath,
						},
					},
					required: ["attachmentItemPath"],
					additionalProperties: false,
				},
				async execute(context) {
					return runTranscribeAudio(context);
				},
			},
			{
				name: "compact_context",
				description: docs.compactContext.description,
				inputSchema: { type: "object", properties: {}, additionalProperties: false },
				async execute(context) {
					return runCompactContext(context);
				},
			},
			{
				name: "search_web",
				description: docs.searchWeb.description,
				inputSchema: {
					type: "object",
					properties: {
						query: { type: "string", description: docs.searchWeb.input.query },
						limit: { type: "number", description: docs.searchWeb.input.limit },
					},
					required: ["query"],
					additionalProperties: false,
				},
				async execute(context) {
					return runSearchWeb(context);
				},
			},
		];

		if (getExecutingEnvironment() !== "tauri") {
			return tools.filter(
				(tool) =>
					!tool.name.startsWith("browser_") && tool.name !== "search_web" && tool.name !== "mail_request",
			);
		}

		return tools;
	}
}

export function getAgentToolsRegistryForSession(app: Application): ToolDefinition[] {
	const browserAllowed = !!app.agentManager.browserAllowed;
	return new AgentToolRegistry().tools.filter((tool) => {
		if ((tool.name.startsWith("browser_") || tool.name === "search_web") && !browserAllowed) return false;
		if (tool.name === "search_web" && !agentBrowserConfig.provider.trim()) return false;
		return true;
	});
}
