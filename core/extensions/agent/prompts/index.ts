import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import type { AgentAttachment } from "../core/attachmentStore";
import type { AgentEvent, AgentQuote } from "../core/events";
import { LinkAdapter } from "../mcp/parser/adapters/linkAdapter";
import { CatalogItemLookup } from "../mcp/utils/catalogPaths";
import { AGENT_PROMPT_MAP } from "./agentPromptMap";
import { MCP_PROMPT_MAP } from "./mcpPromptMap";
import type { AgentSkill } from "./skills/skill";
import { SKILL_PROMPT_MAP } from "./skills/skillPromptMap";
import { systemSkills } from "./skills/system-skills";

export function getToolsDescriptions() {
	return MCP_PROMPT_MAP;
}

export function getSecretsDescription(names: string[] = []): string {
	const vars = names.map((name) => `\${${name}}`).join(", ");
	return `${AGENT_PROMPT_MAP.secretsPreamble} ${vars || "—"}.`;
}

export async function getAgentSkills(
	app: Application,
	ctx: Context,
	commands: CommandTree,
	catalogName?: string,
): Promise<AgentSkill[]> {
	if (!catalogName) return [];

	const catalog = await app.wm.current().getCatalog(catalogName, ctx);
	if (!catalog) return [];

	return catalog.customProviders.agentResourcesProvider.getSkills(app, ctx, commands);
}

async function resolveItemContext(
	app: Application,
	ctx: Context,
	catalogName?: string,
	itemPath?: string,
): Promise<string | null> {
	if (!catalogName || !itemPath) return null;
	const catalog = await app.wm.current().getCatalog(catalogName, ctx);
	if (!catalog) return null;
	const item = CatalogItemLookup.findItem(catalog, itemPath);
	if (!item) return null;
	return JSON.stringify(CatalogItemLookup.fromCatalogItem(catalog, item).asAgentJSON(), null, 2);
}

export async function getOpenCatalogItemDescription(
	app: Application,
	ctx: Context,
	catalogName?: string,
	itemPath?: string,
): Promise<string> {
	const resolved = await resolveItemContext(app, ctx, catalogName, itemPath);
	if (!resolved) return "";
	return `${AGENT_PROMPT_MAP.openItemPreamble}\n${resolved}`;
}

export async function getQuoteDescription(app: Application, ctx: Context, quote: AgentQuote): Promise<string> {
	const quotedText = quote.text
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");

	if (!quote.catalogName) return `${AGENT_PROMPT_MAP.quotedTextPreamble}\n${quotedText}`;

	const articleContext =
		(await resolveItemContext(app, ctx, quote.catalogName, quote.itemPath)) ??
		JSON.stringify({ catalogName: quote.catalogName, itemPath: quote.itemPath ?? "" }, null, 2);
	return `${AGENT_PROMPT_MAP.quotedArticlePreamble}\n${articleContext}\n${AGENT_PROMPT_MAP.quotedFragmentLabel}\n${quotedText}`;
}

export async function getCurrentContextDescription(
	app: Application,
	ctx: Context,
	event: Extract<AgentEvent, { type: "user_message" }>,
): Promise<string> {
	const openItemDescription = await getOpenCatalogItemDescription(
		app,
		ctx,
		event.openCatalogName,
		event.openItemPath,
	);
	const quoteDescription = event.quote?.text ? await getQuoteDescription(app, ctx, event.quote) : "";
	return [openItemDescription, quoteDescription].filter(Boolean).join("\n\n");
}

export async function getSystemPrompt(
	app: Application,
	ctx: Context,
	catalogName?: string,
	skills?: AgentSkill[],
	browserAllowed?: boolean,
): Promise<string> {
	let systemText: string = AGENT_PROMPT_MAP.system;

	if (catalogName) {
		const catalogObj = await app.wm.current().getCatalog(catalogName, ctx);
		if (catalogObj) {
			const promptOverride = await catalogObj.customProviders.agentResourcesProvider.getSystemPrompt();
			systemText = promptOverride ?? AGENT_PROMPT_MAP.system;
		}
	}

	const skillsDescription = getAgentSkillsDescriptions(catalogName, skills);
	const secretsDescription = getSecretsDescription(Object.keys(app.agentManager.secrets.refs()));
	return [systemText, browserAllowed ? AGENT_PROMPT_MAP.browserPreamble : "", secretsDescription, skillsDescription]
		.filter(Boolean)
		.join("\n\n");
}

export function getAttachmentsDescription(attachments: AgentAttachment[] = []): string {
	if (!attachments.length) {
		return "";
	}

	const attachmentItems = attachments.map((attachment) => ({
		attachmentItemPath: LinkAdapter.toAgentAttachmentItemPath(attachment.originalFilename),
	}));

	return `${AGENT_PROMPT_MAP.attachmentsPreamble}\n${JSON.stringify(attachmentItems, null, 2)}`;
}

function getSystemSkillsDescriptions(): string {
	const skillsList = systemSkills.map((skill) => `- ${skill.itemPath}: ${skill.description}`).join("\n");
	if (!skillsList) return "";
	return `${SKILL_PROMPT_MAP.systemSkillsPreamble}\n${skillsList}`;
}

function getCatalogSkillsDescriptions(catalogName: string | undefined, skills: AgentSkill[] | undefined): string {
	if (!catalogName || !skills) return "";
	const skillsList = skills.map((skill) => `- ${skill.itemPath}: ${skill.description}`).join("\n");
	if (!skillsList) return "";
	return `${SKILL_PROMPT_MAP.catalogSkillsPreamble} catalogName: "${catalogName}".\n${skillsList}`;
}

export function getAgentSkillsDescriptions(catalogName: string | undefined, skills: AgentSkill[] | undefined): string {
	const sections = [getSystemSkillsDescriptions(), getCatalogSkillsDescriptions(catalogName, skills)].filter(Boolean);

	if (!sections.length) return "";
	return `${SKILL_PROMPT_MAP.skillsPreamble}\n\n${sections.join("\n\n")}`;
}

export function getForcedSkillDescription(
	catalogName: string | undefined,
	forcedSkill: string | undefined,
	skills: AgentSkill[] | undefined,
): string {
	if (!forcedSkill || !catalogName) return "";
	const skill = skills?.find((item) => item.name === forcedSkill) ?? null;
	if (!skill) {
		console.warn(`getForcedSkillDescription: unknown skill "${forcedSkill}" in catalog "${catalogName}"`);
		return "";
	}

	return `${SKILL_PROMPT_MAP.forcedSkillPreamble}\n- ${skill.itemPath}: ${skill.description}\n\n${skill.content}`;
}

export async function getUserMessage(
	app: Application,
	ctx: Context,
	event: Extract<AgentEvent, { type: "user_message" }>,
	skills?: AgentSkill[],
): Promise<string> {
	const currentContextDescription = await getCurrentContextDescription(app, ctx, event);
	const forcedSkillDescription = getForcedSkillDescription(event.openCatalogName, event.useSkill, skills);
	const attachmentsDescription = getAttachmentsDescription(event.attachments ?? []);
	return [currentContextDescription, forcedSkillDescription, attachmentsDescription, event.content]
		.filter(Boolean)
		.join("\n\n");
}
