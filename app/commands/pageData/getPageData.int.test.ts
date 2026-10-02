import { createCommands } from "@app/commands";
import type Application from "@app/types/Application";
import getApp from "@app/web/app";
import type Context from "@core/Context/Context";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import CookieMock from "@ext/wordExport/tests/CookieMock";
import { resolve } from "path";
import getWebFetchService from "../../../apps/web/src/logic/Api/getWebFetchService";

process.env.ROOT_PATH = resolve(__dirname, "getPageData_tests");
const p = (s: string) => new Path(s);
const dfp = new DiskFileProvider(p(process.env.ROOT_PATH));

const article = (title: string) => `---\ntitle: ${title}\n---\n\n${title.toLowerCase()} body`;

let app: Application;
let commands: ReturnType<typeof createCommands>;
// One reader across app restarts: the record lives in their cookie, not in the app.
let cookie: CookieMock;

const startApp = async () => {
	delete global.app;
	delete global.commands;
	delete global.config;
	app = await getApp();
	commands = createCommands(app);
};

const readerCtx = async (): Promise<Context> => ({
	...(await app.contextFactory.fromWeb({ language: "ru" })),
	cookie,
});

const openPage = async (path: string) =>
	((await commands.page.getPageData.do({ ctx: await readerCtx(), path })).data as ArticlePageData).articleProps;

// What the page does once the article is on screen.
const showPage = async (path: string) => {
	const { pathname } = await openPage(path);
	await commands.page.setLastVisitedArticle.do({ ctx: await readerCtx(), catalogName: "notes", pathname });
};

const catalogCard = async () =>
	(await commands.page.getHomePageData.do({ ctx: await readerCtx(), path: "/" })).data.catalogsLinks.find(
		(link) => link.name === "notes",
	);

// Jest runs as "next": catalogs are read-only and pages go through the read-only branch, as on docportal.
describe("page/getPageData", () => {
	beforeEach(async () => {
		await dfp.delete(p("."));
		await dfp.write(p("notes/.doc-root.yaml"), "title: Notes\n");
		await dfp.write(p("notes/keep.md"), article("Keep"));
		await dfp.write(p("notes/gone.md"), article("Gone"));
		cookie = new CookieMock("");
		await startApp();
	});

	afterAll(async () => {
		await dfp.delete(p("."));
		delete global.app;
		delete global.commands;
		delete global.config;
	});

	test("reading a page leaves the card on the article the reader was shown", async () => {
		await showPage("/notes/keep");

		await openPage("/notes/gone");

		expect((await catalogCard()).lastVisited).toBe("/notes/keep");
	});

	test("the catalog card opens the catalog once its remembered article is gone", async () => {
		await showPage("/notes/gone");
		await dfp.delete(p("notes/gone.md"));
		await startApp();

		const card = await catalogCard();
		expect(card.lastVisited).toBe("/notes/gone");

		expect((await openPage(card.lastVisited)).title).toBe("Keep");
		// Docportal passes the address on without its leading slash.
		expect((await openPage("notes/gone")).title).toBe("Keep");
	});

	// A catalog behind a repository spells its group with an encoded slash in every address.
	test("the article on screen reaches the card with its address as it is", async () => {
		const pathname = "/gitlab.ics-it.ru/gx%2Ftest/notes/master/-/keep";

		const url = new ApiUrlCreator("", "notes").setLastVisitedArticle();
		await getWebFetchService(() => "/")(url, JSON.stringify({ pathname }), MimeTypes.json);

		expect((await catalogCard()).lastVisited).toBe(pathname);
	});

	test("a link to a missing article other than the remembered one stays a 404", async () => {
		await showPage("/notes/keep");

		const opened = await openPage("/notes/nowhere");

		expect(opened.errorCode).toBe(404);
	});
});
