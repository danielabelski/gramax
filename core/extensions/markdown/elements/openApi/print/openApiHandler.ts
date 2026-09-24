import prepareDescriptionBlocks from "@ext/markdown/elements/openApi/print/descriptionBlocks";
import OpenApiPaginator, { OpenApiSectionPaginator } from "@ext/markdown/elements/openApi/print/OpenApiPaginator";
import waitForOpenApiBlocks from "@ext/markdown/elements/openApi/print/waitForOpenApiBlocks";
import { throwIfAborted } from "@ext/print/utils/pagination/abort";
import type { PrintNodeHandler } from "@ext/print/utils/pagination/nodeHandlers";
import Paginator from "@ext/print/utils/pagination/Paginator";

/**
 * Containers whose own children are what flows.
 *
 * Every one of these is the same shape — a box that has to keep its class, its width and its type styles on
 * every page its content runs onto, around a list of children the paginator already knows how to deal out.
 * The children are ordinary content: paragraphs, lists, code blocks, headings, tables, operation cards.
 *
 * The two descriptions are on this list because a spec's Markdown is routinely longer than a page, at the
 * document's level and at a tag's alike. While they were not, each was lifted out as one indivisible run,
 * which put everything around it on a single page box: a thousand pixels under `overflow: hidden` on screen,
 * printed over the next sheet on paper, and on a tag section the tail of the description simply gone.
 */
const FLOWING_CONTAINERS = [
	"doc-header",
	"doc-info",
	"description",
	"grid",
	"section-desc",
	"section-body",
	"section-inner",
	"operation-stack",
	"models-section",
	"models-stack",
];

/** A section is one too: its head, its description and its cards are a list like any other. */
const stackOf = (node: HTMLElement): HTMLElement | null => {
	if (node.tagName === "API-SECTION" || node.tagName === "API-MODELS") return node;
	return FLOWING_CONTAINERS.some((name) => node.classList.contains(name)) ? node : null;
};

/**
 * Everything a block needs before the page it lands on is measured, and before anything decides whether it
 * fits: a wide table is scaled to the page here, and a block short enough to be placed whole never reaches
 * the paginator below — the fit check comes first, and its columns would run off the side of the sheet.
 *
 * Never claims the node. Here rather than in `waitForReady` because the block is on the page and rendered by
 * now, which is what fitting a table needs and what readiness cannot promise: a settled block is one whose
 * model is parsed, and its Markdown is written into the DOM after that.
 */
const openApiPrepareFn: PrintNodeHandler["handle"] = async (node) => {
	if (!OpenApiPaginator.contentHost(node)) return false;

	prepareDescriptionBlocks(node);
	// Heights were taken before any of that happened, and a scaled table reports the size it would have had
	// unscaled. Everything after this is measured against the page, so the block is measured again first.
	await Paginator.paginationInfo.nodeDimension.remeasure(node, Paginator.controlInfo.yieldTick, () =>
		throwIfAborted(Paginator.controlInfo.signal),
	);

	return false;
};

export const openApiPrepareHandler: PrintNodeHandler = {
	isRequired: true,
	handle: openApiPrepareFn,
};

/**
 * One handler for the OpenAPI block as a top-level article node, and for every container met inside it while
 * that block is being split. All of them are lists inside repeatable chrome — see OpenApiPaginator.
 */
const openApiHandlerFn: PrintNodeHandler["handle"] = async (node, paginator) => {
	const contentHost = OpenApiPaginator.contentHost(node);
	const stack = contentHost ?? stackOf(node);
	if (!stack) return false;

	const blockPaginator = contentHost
		? new OpenApiPaginator(node, paginator)
		: new OpenApiSectionPaginator(node, stack, paginator);
	await blockPaginator.paginateNode();

	await Paginator.controlInfo.yieldTick();
	throwIfAborted(Paginator.controlInfo.signal);
	return true;
};

const openApiHandler: PrintNodeHandler = {
	handle: openApiHandlerFn,
	waitForReady: waitForOpenApiBlocks,
};

export default openApiHandler;
