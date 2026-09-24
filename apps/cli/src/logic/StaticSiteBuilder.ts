import { type AppConfig, getConfig } from "@app/config/AppConfig";
import resolveBackendModule from "@app/resolveModule/backend";
import { getExecutingEnvironment } from "@app/resolveModule/env";
import type Application from "@app/types/Application";
import type DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { joinTitles } from "@core-ui/getPageTitle";
import { ContentLanguage } from "@ext/localization/core/model/Language";
import { createModulithFileProviders, createModulithService } from "@ext/serach/modulith/createModulithService";
import { RemoteModulithSearchClient } from "@ext/serach/modulith/search/RemoteModulithSearchClient";
import { getRawEnabledFeatures } from "@ext/toggleFeatures/features";
import assert from "assert";
import crypto from "crypto-js";
import { dirname } from "path";
import type { HtmlData } from "./ArticleTypes";
import CliUserError from "./CliUserError";
import { logStep, logStepWithErrorSuppression, logStepWithProgress } from "./cli/utils/logger";
import {
	type DirectoryInfoBasic,
	type FileInfoBasic,
	InitialDataKeys,
	type StaticConfig,
} from "./initialDataUtils/types";
import renderDescriptionMetaTag from "./renderDescriptionMetaTag";
import StaticContentCopier, { type CopyTemplatesFunction, type StaticFileProvider } from "./StaticContentCopier";
import StaticRenderer, { STATIC_WORKSPACE_PATH } from "./StaticRenderer";
import generateStaticSeo from "./StaticSeoGenerator";

const htmlTags = {
	lang: "<!--html-lang-->",
	base: "<!--base-tag-->",
	title: "<!--title-content-->",
	description: "<!--description-content-->",
	config: "<!--app-config-->",
	fs: "<!--data.js-->",
	data: "<!--app-data-->",
	body: "<!--app-body-->",
	styles: "<!--app-styles-->",
};

// Kept in sync with the `lang` written into apps/cli/index.html before the
// placeholder was introduced: a catalog that declares no language builds
// exactly as it did before.
const DEFAULT_HTML_LANG = ContentLanguage.ru;

// `language` comes from user-authored .doc-root.yaml and is typed, not validated,
// so anything unknown falls back instead of landing inside the lang attribute.
const resolveHtmlLang = (language?: string) =>
	language && (Object.values(ContentLanguage) as string[]).includes(language) ? language : DEFAULT_HTML_LANG;

const CUSTOM_STYLE_FILENAME = "styles.css";
const CUSTOM_STYLE_LINK_ID = "custom-style-link";

const isWeb = getExecutingEnvironment() === "web";

interface StaticSiteGenerationOptions {
	baseUrl?: string;
	customStyles?: string;
	aiPublicToken?: string;
	copyTemplate?: {
		copyWordTemplatesFunction?: CopyTemplatesFunction;
		copyPdfTemplatesFunction?: CopyTemplatesFunction;
	};
}

interface StaticSiteBuilderParams {
	fp: StaticFileProvider;
	app: Application;
	html: string;
	getCache: {
		fp?: () => { cacheFileProvider: DiskFileProvider; articleStorageFileProvider: DiskFileProvider };
		tree: () => DirectoryInfoBasic | Promise<DirectoryInfoBasic>;
	};
}

class StaticSiteBuilder {
	constructor(private _params: StaticSiteBuilderParams) {}
	static readonly readonlyDir = "../bundle";

	private _generateHash(content: string): string {
		return crypto.MD5(content).toString().substring(0, 8);
	}

	async generate(catalog: Catalog, targetDir: Path, options: StaticSiteGenerationOptions) {
		const { copyTemplate, customStyles, baseUrl, aiPublicToken } = options;
		const catalogName = catalog.name;

		const directoryCopier = new StaticContentCopier(this._params.fp, this._params.app);
		const { zipFilename } = await logStepWithErrorSuppression("Copying directory", () =>
			directoryCopier.copyCatalog(catalog, targetDir),
		);
		const { directoryTree, wordTemplates, pdfTemplates } = await directoryCopier.copyWordTemplates(copyTemplate);

		const aiConfig = this._getStaticPortalAiConfig(aiPublicToken);

		const rendered = await logStepWithErrorSuppression("Rendering HTML pages", () =>
			new StaticRenderer(this._params.app, {
				wordTemplates,
				pdfTemplates,
				aiEnabled: aiConfig.enabled,
			}).render(catalogName),
		);

		const searchDirectoryTree = await logStepWithProgress("Building search index", (onProgress) =>
			this._createSearchIndexes(catalog, targetDir, aiConfig.enabled, onProgress),
		);
		const catalogDirectory = directoryTree.children.find((v) => v.name === catalogName) as DirectoryInfoBasic;
		assert(catalogDirectory, "not found catalog directory in directory tree");

		catalogDirectory.children.push(searchDirectoryTree);

		if (customStyles) {
			await this._params.fp.write(targetDir.join(new Path([catalogName, CUSTOM_STYLE_FILENAME])), customStyles);
			const customStyleLinkTag = this._createCustomStyleLinkTag(catalogName);
			this._params.html = this._params.html.replace(htmlTags.styles, `${customStyleLinkTag}\n${htmlTags.styles}`);
		}

		const dataJsContent = `window.${InitialDataKeys.DIRECTORY} = ${this._stringifyDataSafely(directoryTree)};`;

		const dataJsHash = this._generateHash(dataJsContent);
		const dataJsFilename = `data.${dataJsHash}.js`;

		await this._params.fp.write(targetDir.join(new Path([catalogName, dataJsFilename])), dataJsContent);

		await logStep("Writing rendered HTML files", () =>
			this._writingRenderedHtmlFiles(rendered, targetDir, catalogName, dataJsFilename, zipFilename, aiConfig),
		);

		if (baseUrl)
			await logStep("Creating sitemap.xml & robots.txt", () => this._writeSEOFiles(baseUrl, catalog, targetDir));
	}

	private _createSearchIndexes = async (
		catalog: Catalog,
		targetDir: Path,
		aiEnabled: boolean,
		onProgress?: (progress: number) => void,
	) => {
		const { cacheFileProvider, articleStorageFileProvider } =
			this._params.getCache.fp?.() ?? createModulithFileProviders(targetDir.join(new Path(catalog.name)));
		const client = await resolveBackendModule("getModulithSearchClient")({
			cacheFileProvider,
			articleStorageFileProvider,
		});

		const modulithService = await createModulithService({
			parser: this._params.app.parser,
			parserContextFactory: this._params.app.parserContextFactory,
			wm: this._params.app.wm,
			resourceParseClient: undefined,
			localClient: client,
			remoteClient: await this._createRemoteSearchClient(aiEnabled),
			tablesManager: this._params.app.tablesManager,
			resourceSearchEnabled: this._params.app.conf.search.resourceSearchEnabled,
			failOnRemoteError: aiEnabled,
		});

		await modulithService.updateCatalog(catalog.name, STATIC_WORKSPACE_PATH, onProgress);
		await modulithService.terminate();

		const tree = await this._params.getCache.tree();
		return tree;
	};

	private async _createRemoteSearchClient(aiEnabled: boolean): Promise<RemoteModulithSearchClient | undefined> {
		if (!aiEnabled) return undefined;
		const { portalAi } = getConfig();
		const { client, serverAvailable, authAvailable } = await RemoteModulithSearchClient.create({
			apiUrl: portalAi.apiUrl,
			apiKey: portalAi.token,
			collectionName: portalAi.instanceName,
		});

		if (!serverAvailable || !authAvailable)
			throw new CliUserError(`AI server ${portalAi.apiUrl} is unavailable or the token is invalid`);

		return client;
	}

	private _writingRenderedHtmlFiles = async (
		htmlDatas: HtmlData[],
		targetDir: Path,
		catalogName: string,
		dataJsFilename: string,
		zipFilename: string,
		aiConfig?: AppConfig["portalAi"],
	) => {
		const config = getConfig();
		config.isProduction = true;
		config.isReadOnly = true;

		const staticConfig: StaticConfig = {
			...config,
			features: getRawEnabledFeatures(),
			portalAi: aiConfig,
		};

		const templateHtml = this._params.html
			.replace(
				htmlTags.config,
				`window.${InitialDataKeys.CONFIG} = ${this._stringifyDataSafely(staticConfig) ?? "{}"}`,
			)
			.replace(
				htmlTags.fs,
				`<script src="${catalogName}/${dataJsFilename}"></script>\n` +
					`<script>window.${InitialDataKeys.ZIP_FILENAME} = "${zipFilename}";</script>`,
			);

		const generateHtmlFile = async (htmlData: HtmlData) => {
			const is404Html = htmlData.initialData.data?.articlePageData?.articleProps?.errorCode === 404;
			const dataKey = `window.${InitialDataKeys.DATA} = `;
			const initialData = this._escapeDollars(this._stringifyDataSafely(htmlData.initialData) ?? "{}");

			const getLogicPath = () => {
				const get404Path = () => {
					if (isWeb) return [htmlData.logicPath, "404.html"];
					return [htmlData.logicPath.substring(catalogName.length), "404.html"];
				};

				if (is404Html) return new Path(get404Path());
				return new Path(htmlData.logicPath).join(new Path("index.html"));
			};

			const logicPath = getLogicPath();

			const calculatedBasePath = is404Html ? "/" : logicPath.getRelativePath(new Path("."));
			const title = joinTitles(
				htmlData.initialData.data.articlePageData.articleProps.title,
				htmlData.initialData.data.catalogProps.title,
			);

			const html = StaticSiteBuilder.buildArticleHtml(templateHtml, {
				base: String(calculatedBasePath),
				title,
				description: htmlData.initialData.data.articlePageData.articleProps.description,
				data: dataKey + initialData,
				body: htmlData.htmlContent.body ?? "",
				styles: htmlData.htmlContent.styles ?? "",
				// ctx.contentLanguage is filled only for multi-language catalogs;
				// a single-language catalog carries its language in catalogProps
				// (same fallback idiom as parseContent / SitePresenter).
				contentLanguage:
					htmlData.initialData.context?.language?.content || htmlData.initialData.data.catalogProps?.language,
			});

			const filePath = targetDir.join(logicPath);
			await this._params.fp.mkdir(new Path(dirname(filePath.value)));
			await this._params.fp.write(filePath, html);
		};

		if (!isWeb)
			await this._params.fp.write(targetDir.join(new Path("index.html")), this._getRedirectHTML(catalogName));

		for (const htmlData of htmlDatas) await generateHtmlFile(htmlData);
	};

	private async _writeSEOFiles(baseUrl: string, catalog: Catalog, targetDir: Path) {
		const sanitizeBaseUrl = baseUrl.trim().replace(/\/+$/, "");
		const workspace = this._params.app.wm.current();
		const SEOFiles = await generateStaticSeo(sanitizeBaseUrl, catalog, workspace);
		await SEOFiles.mapAsync(async ({ content, name }) => {
			await this._params.fp.write(targetDir.join(new Path(isWeb ? [catalog.name, name] : name)), content);
		});
	}

	private _getStaticPortalAiConfig(aiPublicToken?: string): AppConfig["portalAi"] {
		const { portalAi } = getConfig();
		const enabled = portalAi.enabled && Boolean(aiPublicToken);

		return {
			enabled,
			apiUrl: enabled ? portalAi.apiUrl : "",
			instanceName: enabled ? portalAi.instanceName : "",
			token: enabled ? aiPublicToken : "",
		};
	}

	private _stringifyDataSafely(config: Parameters<JSON["stringify"]>[0]) {
		return JSON.stringify(config).replaceAll("<", "\\u003C");
	}

	private _escapeDollars(str: string) {
		return str.replaceAll("$$", "$$$$$$$$");
	}

	static buildArticleHtml(
		templateHtml: string,
		parts: {
			base: string;
			title: string;
			description?: string;
			data: string;
			body: string;
			styles: string;
			contentLanguage?: string;
		},
	): string {
		return templateHtml
			.replace(htmlTags.lang, resolveHtmlLang(parts.contentLanguage))
			.replace(htmlTags.base, `<base href="${parts.base}">`)
			.replace(htmlTags.title, parts.title)
			.replace(htmlTags.description, () => renderDescriptionMetaTag(parts.description))
			.replace(htmlTags.data, parts.data)
			.replace(htmlTags.body, parts.body)
			.replace(htmlTags.styles, parts.styles);
	}

	private _getRedirectHTML(catalogName: string) {
		return `<!doctype html>
	<html lang="ru">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>${catalogName}</title>
		<meta http-equiv="refresh" content="0;url=./${catalogName}">
	</head>
	</html>`;
	}

	private _createCustomStyleLinkTag(catalogName: string) {
		return `<link id="${CUSTOM_STYLE_LINK_ID}" rel="stylesheet" crossorigin href="${catalogName}/${CUSTOM_STYLE_FILENAME}">`;
	}

	static buildDirectoryTreeFromPaths(filePaths: string[]): DirectoryInfoBasic {
		const root: DirectoryInfoBasic = {
			name: "",
			type: "dir",
			children: [],
		};

		for (const filePath of filePaths) {
			const parts = filePath.split("/");
			let current = root;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const isLast = i === parts.length - 1;

				if (isLast) {
					const file: FileInfoBasic = {
						name: part,
						type: "file",
					};
					current.children.push(file);
				} else {
					let dir = current.children.find(
						(child) => child.type === "dir" && child.name === part,
					) as DirectoryInfoBasic;

					if (!dir) {
						dir = {
							name: part,
							type: "dir",
							children: [],
						};
						current.children.push(dir);
					}
					current = dir;
				}
			}
		}

		return root;
	}
}

export default StaticSiteBuilder;
