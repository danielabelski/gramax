import { createCommands } from "@app/commands";
import { getConfig } from "@app/config/AppConfig";
import type Application from "@app/types/Application";
import getApp from "@app/web/app";
import type Context from "@core/Context/Context";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { ClientArticleProps } from "@core/SitePresenter/SitePresenter";
import CookieMock from "@ext/wordExport/tests/CookieMock";
import { resolve } from "path";

process.env.ROOT_PATH = resolve(__dirname, "updateProps_tests");
const p = (s: string) => new Path(s);
const dfp = new DiskFileProvider(p(process.env.ROOT_PATH));

const article = (title: string) => `---\ntitle: ${title}\n---\n\nbody`;

let app: Application;
let commands: ReturnType<typeof createCommands>;
let ctx: Context;

const open = async (logicPath: string) =>
	(await commands.page.getArticlePageData.do({ ctx, path: logicPath })).data.articleProps;

// What the page does once the article is on screen.
const show = async (logicPath: string) => {
	const { pathname } = await open(logicPath);
	await commands.page.setLastVisitedArticle.do({ ctx, catalogName: "notes", pathname });
};

const renameByTitle = (props: ClientArticleProps, title: string, fileName: string) =>
	commands.item.updateProps.do({ ctx, catalogName: "notes", props: { ...props, title, fileName } });

const catalogCard = async () =>
	(await commands.page.getHomePageData.do({ ctx, path: "/" })).data.catalogsLinks.find(
		(link) => link.name === "notes",
	);

describe("item/updateProps", () => {
	beforeAll(async () => {
		await dfp.delete(p("."));
		await dfp.write(p("notes/.doc-root.yaml"), "title: Notes\n");
		await dfp.write(p("notes/section/_index.md"), article("Section"));
		await dfp.write(p("notes/section/child.md"), article("Child"));
		delete global.app;
		delete global.commands;
		delete global.config;
		// Jest runs as "next", which AppConfig treats as read-only; the editor this covers is not.
		getConfig().isReadOnly = false;
		app = await getApp();
		commands = createCommands(app);
	});

	beforeEach(async () => {
		window.sessionStorage.clear();
		// One cookie for the whole session: the home page reads what the article page wrote.
		ctx = { ...(await app.contextFactory.fromWeb({ language: "ru" })), cookie: new CookieMock("") };
	});

	afterAll(async () => {
		await dfp.delete(p("."));
		delete global.app;
		delete global.commands;
		delete global.config;
	});

	test("the catalog card follows the article inside a section renamed by its title", async () => {
		const section = await open("notes/section");
		await show("notes/section/child");
		await renameByTitle(section, "Chapter", "chapter");

		const card = await catalogCard();
		const child = await open("notes/chapter/child");

		expect(child.title).toBe("Child");
		expect(card.lastVisited).toBe(child.pathname);
	});
});
