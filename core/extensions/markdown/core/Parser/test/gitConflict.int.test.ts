import getApp from "@app/node/app";
import { getParserTestData } from "./getParserTestData";

const CONFLICT = "<<<<<<< Updated upstream\nHello\n=======\nBye\n>>>>>>> Stashed changes\n";
const FENCE = "```";

// The app, the catalog and the parser boot on first use. A cold boot on a loaded machine outruns
// the per-test timeout, so it is paid once here, with room, and every test times only itself.
beforeAll(async () => {
	await getParserTestData();
}, 60_000);

describe("Git conflict in an article", () => {
	const parse = async (content: string) => {
		const { parseContext, parser } = await getParserTestData();
		return (await parser.parse(content, parseContext)).editTree;
	};

	const format = async (editTree: unknown) => {
		const { parseContext } = await getParserTestData();
		const app = await getApp();
		return app.formatter.render(editTree as never, parseContext);
	};

	test("keeps markers and both versions on their own lines", async () => {
		const editTree = await parse(CONFLICT);

		expect(editTree.content).toHaveLength(1);
		expect(editTree.content[0]).toMatchObject({
			type: "code_block",
			attrs: { gitConflict: true },
			content: [{ type: "text", text: CONFLICT.trimEnd() }],
		});
	});

	test("writes the conflict back unchanged", async () => {
		const editTree = await parse(CONFLICT);

		expect(await format(editTree)).toEqual(CONFLICT.trimEnd());
	});

	test("keeps a conflict whose side is empty", async () => {
		const oneSideDeleted = "<<<<<<< Updated upstream\n=======\nBye\n>>>>>>> Stashed changes\n";

		const editTree = await parse(oneSideDeleted);

		expect(editTree.content[0]).toMatchObject({ type: "code_block", attrs: { gitConflict: true } });
		expect(await format(editTree)).toEqual(oneSideDeleted.trimEnd());
	});

	test("leaves the text around the conflict untouched", async () => {
		const content = `Перед конфликтом.\n\n${CONFLICT}\nПосле конфликта.\n`;

		const editTree = await parse(content);

		expect(editTree.content.map((node) => node.type)).toEqual(["paragraph", "code_block", "paragraph"]);
		expect(await format(editTree)).toEqual(content.trimEnd());
	});
});

describe("Code block without a conflict", () => {
	test("keeps conflict markers written inside it", async () => {
		const { parseContext, parser } = await getParserTestData();
		const app = await getApp();
		const documented = `${FENCE}md\n${CONFLICT}${FENCE}`;

		const editTree = (await parser.parse(documented, parseContext)).editTree;

		expect(editTree.content[0]).toMatchObject({ type: "code_block", attrs: { gitConflict: false } });
		expect(await app.formatter.render(editTree, parseContext)).toEqual(documented);
	});

	test("keeps its fences and language", async () => {
		const { parseContext, parser } = await getParserTestData();
		const app = await getApp();
		const codeBlock = "```ts\nconst a = 1;\n```";

		const editTree = (await parser.parse(codeBlock, parseContext)).editTree;

		expect(editTree.content[0]).toMatchObject({ type: "code_block", attrs: { gitConflict: false } });
		expect(await app.formatter.render(editTree, parseContext)).toEqual(codeBlock);
	});
});
