import type { CommandTree } from "@app/commands";
import { GRAMAX_DIRECTORY } from "@app/config/const";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Article, ArticleProps } from "@core/FileStructue/Article/Article";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type FileStructure from "@core/FileStructue/FileStructure";
import ArticleProvider from "@ext/articleProvider/logic/ArticleProvider";
import assert from "assert";
import { AgentArticleParser, MarkdownDocumentParser } from "../mcp/parser";
import type { AgentSkill } from "../prompts/skills/skill";
import { systemSkills } from "../prompts/skills/system-skills";
import { agentConfig } from "./agentConfig";

const SYSTEM_PROMPT_PATH = new Path(["agent", "system-prompt.md"]);
const AGENT_SKILLS_DIR = new Path(["agent", "skills"]);

export type { AgentSkill } from "../prompts/skills/skill";

declare module "@ext/articleProvider/logic/ArticleProvider" {
	export enum ArticleProviders {
		agentSkill = "agentSkill",
	}
}

export default class AgentResourcesProvider extends ArticleProvider {
	constructor(fp: FileProvider, fs: FileStructure, catalog: Catalog) {
		super(fp, fs, catalog, AGENT_SKILLS_DIR);

		fs.events.on("catalog-read", async () => {
			await this.readArticles();
		});
	}

	public async getSkills(app: Application, ctx: Context, commands: CommandTree): Promise<AgentSkill[]> {
		const articles = await this.getItems<Article<ArticleProps>>(true);
		const skills: AgentSkill[] = [];
		for (const article of articles) {
			skills.push(await this._mapArticleToAgentSkill(app, ctx, commands, article));
		}
		return skills;
	}

	public async getSkillArticleByItemPath(itemPath: string): Promise<Article<ArticleProps> | null> {
		const skillName = AgentResourcesProvider.skillNameFromItemPath(itemPath);
		const articles = await this.getItems<Article<ArticleProps>>(true);
		return articles.find((item) => item.props.title === skillName || item.ref.path.name === skillName) ?? null;
	}

	public async getSkillByItemPath(
		app: Application,
		ctx: Context,
		commands: CommandTree,
		itemPath: string,
	): Promise<AgentSkill | null> {
		const article = await this.getSkillArticleByItemPath(itemPath);
		if (!article) return null;
		return this._mapArticleToAgentSkill(app, ctx, commands, article);
	}

	public async getSkillByName(
		app: Application,
		ctx: Context,
		commands: CommandTree,
		skillName: string,
	): Promise<AgentSkill | null> {
		return this.getSkillByItemPath(app, ctx, commands, AgentResourcesProvider.skillNametoItemPath(skillName));
	}

	public async getSystemPrompt(): Promise<string | null> {
		const promptPath = this._catalog.basePath.join(new Path([GRAMAX_DIRECTORY, SYSTEM_PROMPT_PATH.value]));
		if (!(await this._fp.exists(promptPath))) return null;

		const markdown = await this._fp.read(promptPath);
		const { content } = this._fs.parseMarkdown(markdown);
		const prompt = content.trim();
		return prompt || null;
	}

	public static isSystemCatalog(catalogName: string): boolean {
		return catalogName === agentConfig.systemPrefix;
	}

	public static isSkillItemPath(itemPath: string): boolean {
		return itemPath.includes(agentConfig.skillPrefix);
	}

	public static skillNametoItemPath(skillName: string): string {
		return `${agentConfig.skillPrefix}/${skillName}`;
	}

	public static skillNameFromItemPath(itemPath: string): string {
		assert(AgentResourcesProvider.isSkillItemPath(itemPath), `itemPath is not a skill path`);
		return itemPath.split(`${agentConfig.skillPrefix}/`)[1];
	}

	public static async getSkill(
		app: Application,
		ctx: Context,
		commands: CommandTree,
		catalogName: string,
		itemPath: string,
	): Promise<AgentSkill | null> {
		if (!AgentResourcesProvider.isSkillItemPath(itemPath)) return null;

		if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
			return systemSkills.find((skill) => skill.itemPath === itemPath) ?? null;
		}

		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		if (!catalog) return null;

		return catalog.customProviders.agentResourcesProvider.getSkillByItemPath(app, ctx, commands, itemPath);
	}

	private async _mapArticleToAgentSkill(
		app: Application,
		ctx: Context,
		commands: CommandTree,
		article: Article<ArticleProps>,
	): Promise<AgentSkill> {
		const body = (await article.getContent()).trim();
		const { firstParagraph } = MarkdownDocumentParser.splitFirstParagraph(body);
		const catalog = this._catalog.ctx(ctx);
		const parser = await AgentArticleParser.open(app, ctx, commands, catalog, article);
		const name = article.props.title;

		return {
			name,
			itemPath: AgentResourcesProvider.skillNametoItemPath(name),
			catalogName: this._catalog.name,
			description: firstParagraph,
			content: await parser.getMarkdownForAgent(),
		};
	}
}
