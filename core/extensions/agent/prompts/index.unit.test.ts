import Path from "@core/FileProvider/Path/Path";
import { PropertyTypes, SystemProperties } from "@ext/properties/models";
import type { AgentEvent } from "../core/events";
import {
	getCatalogPropertiesDescription,
	getForcedSkillDescription,
	getOpenCatalogItemDescription,
	getSecretsDescription,
	getSystemPrompt,
	getUserMessage,
} from ".";
import { AGENT_PROMPT_MAP } from "./agentPromptMap";
import type { AgentSkill } from "./skills/skill";
import { SKILL_PROMPT_MAP } from "./skills/skillPromptMap";
import { systemSkills } from "./skills/system-skills";

const createApp = (skills: AgentSkill[], secrets: Record<string, string> = {}) =>
	({
		agentManager: {
			secrets: {
				refs: () => secrets,
			},
		},
		wm: {
			current: () => ({
				getCatalog: async () => ({
					name: "docs",
					findItemByItemPath: (path: Path) =>
						path.value === "docs/section/a.md"
							? {
									ref: { path: new Path("docs/section/a.md") },
									logicPath: "docs/section/a",
									getTitle: () => "Title",
								}
							: null,
					getRepositoryRelativePath: () => new Path("section/a.md"),
					customProviders: {
						agentResourcesProvider: {
							getSkills: async () => skills,
							getSkillByItemPath: async (_app, _ctx, _commands, itemPath: string) =>
								skills.find((skill) => skill.itemPath === itemPath) ?? null,
							getSkillByName: async (_app, _ctx, _commands, skillName: string) =>
								skills.find((skill) => skill.name === skillName) ?? null,
							getSkillArticleByItemPath: async () => null,
							getSystemPrompt: async () => null,
						},
					},
				}),
			}),
		},
	}) as never;

describe("prompts/index", () => {
	test("getSecretsDescription lists available secret placeholders", () => {
		expect(getSecretsDescription()).toContain(AGENT_PROMPT_MAP.secretsPreamble);
		expect(getSecretsDescription()).toContain("—");
		expect(getSecretsDescription(["API_KEY.token"])).toContain(`\${API_KEY.token}`);
	});

	test("getOpenCatalogItemDescription returns empty string for missing required fields", async () => {
		const app = createApp([]);
		await expect(getOpenCatalogItemDescription(app, {} as never)).resolves.toBe("");
		await expect(getOpenCatalogItemDescription(app, {} as never, "docs")).resolves.toBe("");
		await expect(getOpenCatalogItemDescription(app, {} as never, "docs", "")).resolves.toBe("");
	});

	test("getOpenCatalogItemDescription returns preamble with serialized context", async () => {
		const app = createApp([]);
		const fromGramax = await getOpenCatalogItemDescription(app, {} as never, "docs", "section/a.md");
		const fromAgent = await getOpenCatalogItemDescription(app, {} as never, "docs", "section/a");

		for (const text of [fromGramax, fromAgent]) {
			expect(text).toContain(AGENT_PROMPT_MAP.openItemPreamble);
			expect(text).toContain('"catalogName": "docs"');
			expect(text).toContain('"itemPath": "section/a"');
			expect(text).toContain('"title": "Title"');
		}
	});

	test("getCatalogPropertiesDescription lists user properties and skips system ones", () => {
		const text = getCatalogPropertiesDescription({
			filterProperty: "status",
			properties: [
				{
					id: "status",
					name: "\u0421\u0442\u0430\u0442\u0443\u0441",
					type: PropertyTypes.enum,
					style: "blue",
					values: ["draft", "ready"],
				},
				{
					id: "important",
					name: "\u0412\u0430\u0436\u043d\u043e\u0435",
					type: PropertyTypes.flag,
					style: "red",
				},
				{ id: SystemProperties.hierarchy, name: "hierarchy", type: PropertyTypes.many, style: "gray" },
			],
		} as never);

		expect(text).toContain(AGENT_PROMPT_MAP.catalogPropertiesPreamble);
		expect(text).toContain("- \u0421\u0442\u0430\u0442\u0443\u0441 (id: status, Enum): draft, ready");
		expect(text).toContain("- \u0412\u0430\u0436\u043d\u043e\u0435 (id: important, Flag)");
		expect(text).not.toContain(SystemProperties.hierarchy);
		expect(text).toContain(`${AGENT_PROMPT_MAP.catalogFilterPropertyLabel} \u0421\u0442\u0430\u0442\u0443\u0441.`);
	});

	test("getCatalogPropertiesDescription returns empty string when there are no user properties", () => {
		expect(getCatalogPropertiesDescription(undefined)).toBe("");
		expect(getCatalogPropertiesDescription({ properties: [] } as never)).toBe("");
		expect(
			getCatalogPropertiesDescription({
				properties: [
					{ id: SystemProperties.hierarchy, name: "hierarchy", type: PropertyTypes.many, style: "gray" },
				],
			} as never),
		).toBe("");
	});

	test("getSystemPrompt returns system text from map when catalog is missing", async () => {
		const app = {
			agentManager: { secrets: { refs: () => ({}) } },
			wm: {
				current: () => ({
					getCatalog: async () => null,
				}),
			},
		} as never;
		const text = await getSystemPrompt(app, {} as never, "docs");
		expect(text).toContain(AGENT_PROMPT_MAP.system);
		expect(text).toContain(AGENT_PROMPT_MAP.secretsPreamble);
	});

	test("getSystemPrompt returns override from catalog provider", async () => {
		const app = {
			agentManager: { secrets: { refs: () => ({}) } },
			wm: {
				current: () => ({
					getCatalog: async () => ({
						ctx: () => ({ name: "docs" }),
						props: {
							properties: [
								{
									id: "status",
									name: "\u0421\u0442\u0430\u0442\u0443\u0441",
									type: PropertyTypes.enum,
									style: "blue",
									values: ["draft"],
								},
							],
						},
						customProviders: {
							agentResourcesProvider: {
								getSkills: async () => [],
								getSystemPrompt: async () => "custom system prompt",
							},
						},
					}),
				}),
			},
		} as never;
		const text = await getSystemPrompt(app, {} as never, "docs");
		expect(text).toContain("custom system prompt");
		expect(text).not.toContain("## Оформление");
		expect(text).toContain(AGENT_PROMPT_MAP.catalogPropertiesPreamble);
	});

	test("getSystemPrompt joins system prompt, secrets and skills list", async () => {
		const catalogSkills = [
			{
				itemPath: "@skills/test-skill",
				catalogName: "docs",
				name: "test-skill",
				description: "Test description",
				content: "",
			},
		];
		const text = await getSystemPrompt(
			createApp(catalogSkills, { "Yandex.token": "x" }),
			{} as never,
			"docs",
			catalogSkills,
		);

		expect(text).toContain(AGENT_PROMPT_MAP.system);
		expect(text).toContain("## Оформление");
		expect(text).not.toContain("Диаграммы Mermaid");
		expect(text).toContain(AGENT_PROMPT_MAP.secretsPreamble);
		expect(text).toContain(`\${Yandex.token}`);
		expect(text).toContain(SKILL_PROMPT_MAP.skillsPreamble);
		expect(text).toContain(SKILL_PROMPT_MAP.systemSkillsPreamble);
		expect(text).toContain(SKILL_PROMPT_MAP.catalogSkillsPreamble);
		expect(text).toContain(systemSkills[0].itemPath);
		expect(text).toContain("@skills/test-skill");
	});

	test("getSystemPrompt adds browser preamble only when browser is allowed", async () => {
		const plain = await getSystemPrompt(createApp([]), {} as never, "docs");
		const withBrowser = await getSystemPrompt(createApp([]), {} as never, "docs", undefined, true);

		expect(plain).not.toContain(AGENT_PROMPT_MAP.browserPreamble);
		expect(withBrowser).toContain(AGENT_PROMPT_MAP.browserPreamble);
	});

	test("getForcedSkillDescription returns forced block with full skill content", () => {
		const catalogSkills = [
			{
				itemPath: "@skills/test-skill",
				catalogName: "docs",
				name: "test-skill",
				description: "Описание",
				content: "Полный контент",
			},
		];
		const text = getForcedSkillDescription("docs", "test-skill", catalogSkills);

		expect(text).toContain(SKILL_PROMPT_MAP.forcedSkillPreamble);
		expect(text).toContain("@skills/test-skill");
		expect(text).toContain("Описание");
		expect(text).toContain("Полный контент");
	});

	test("getForcedSkillDescription returns empty string for unknown skill", () => {
		expect(getForcedSkillDescription("docs", "missing-skill", [])).toBe("");
	});

	test("getUserMessage joins open context, attachments, skill, and user text", async () => {
		const event: Extract<AgentEvent, { type: "user_message" }> = {
			type: "user_message",
			turnId: "turn-1",
			ts: 1,
			content: "Проверь файл",
			browserAllowed: true,
			openCatalogName: "docs",
			openItemPath: "section/a.md",
			useSkill: "test-skill",
			attachments: [
				{
					originalFilename: "notes.txt",
					storagePath: "sessions/sess-1/attachments/notes.txt",
					size: 18,
					mime: "text/plain",
				},
			],
		};
		const catalogSkills = [
			{
				itemPath: "@skills/test-skill",
				catalogName: "docs",
				name: "test-skill",
				description: "Описание",
				content: "Полный контент",
			},
		];
		const text = await getUserMessage(createApp(catalogSkills), {} as never, event, catalogSkills);

		expect(text).toContain(AGENT_PROMPT_MAP.openItemPreamble);
		expect(text).toContain(AGENT_PROMPT_MAP.attachmentsPreamble);
		expect(text).toContain(SKILL_PROMPT_MAP.forcedSkillPreamble);
		expect(text).toContain("Проверь файл");
		expect(text).toContain("@attachments/notes.txt");
		expect(text).toContain("attachmentItemPath");
	});

	test("getUserMessage includes quote description when present", async () => {
		const event: Extract<AgentEvent, { type: "user_message" }> = {
			type: "user_message",
			turnId: "turn-1",
			ts: 1,
			content: "что это значит?",
			quote: {
				catalogName: "docs",
				itemPath: "section/a.md",
				text: "выделенный фрагмент",
			},
		};
		const text = await getUserMessage(createApp([]), {} as never, event);

		expect(text).toContain(AGENT_PROMPT_MAP.quotedArticlePreamble);
		expect(text).toContain(AGENT_PROMPT_MAP.quotedFragmentLabel);
		expect(text).toContain("> выделенный фрагмент");
		expect(text).toContain("что это значит?");
	});

	test("getUserMessage returns only user text when no extras", async () => {
		const event: Extract<AgentEvent, { type: "user_message" }> = {
			type: "user_message",
			turnId: "turn-1",
			ts: 1,
			content: "hello",
		};
		await expect(getUserMessage(createApp([]), {} as never, event)).resolves.toBe("hello");
	});
});
