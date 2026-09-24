import MarkdownParser from "@ext/markdown/core/Parser/Parser";
import preTransformTokens, {
	type MaybeAsyncPreTransformerFunc,
	type PreTransformerFunc,
} from "@ext/markdown/core/Parser/Transformer/preTransformTokens";
import type { Token } from "@ext/markdown/core/render/logic/Markdoc";

describe("preTransformTokens", () => {
	test("runs plugin transformers after built-in transformers", async () => {
		const parser = new MarkdownParser();
		const calls: string[] = [];
		const pluginTransformer: PreTransformerFunc = ({ tokens }) => {
			calls.push("plugin");
			return [...tokens, { type: "plugin" } as Token];
		};
		const subscription = parser.events.on("get-pre-transformers", ({ mutable }) => {
			mutable.preTransformers.push(pluginTransformer);
		});

		const result = await preTransformTokens({ tokens: [{ type: "text" } as Token], parser });

		expect(subscription).toBeDefined();
		expect(calls).toEqual(["plugin"]);
		expect(result.at(-1)?.type).toBe("plugin");
	});

	test("waits for asynchronous plugin transformers", async () => {
		const parser = new MarkdownParser();
		const asyncTransformer: MaybeAsyncPreTransformerFunc = async ({ tokens }) => {
			await Promise.resolve();
			return [...tokens, { type: "async-plugin" } as Token];
		};
		const subscription = parser.events.on("get-pre-transformers", ({ mutable }) => {
			mutable.preTransformers.push(asyncTransformer);
		});

		const result = await preTransformTokens({ tokens: [{ type: "text" } as Token], parser });

		expect(subscription).toBeDefined();
		expect(result.at(-1)?.type).toBe("async-plugin");
	});

	test("runs the table transformer for native Markdown table tokens", async () => {
		const parser = new MarkdownParser();
		const tokens = [
			{ type: "table_open" },
			{ type: "tbody_open" },
			{ type: "tr_open" },
			{ type: "td_open" },
			{ type: "inline", children: [{ type: "text", content: "Cell" }] },
			{ type: "td_close" },
			{ type: "tr_close" },
			{ type: "tbody_close" },
			{ type: "table_close" },
		] as Token[];

		const result = await preTransformTokens({ tokens, parser });

		expect(result.map((token) => token.type)).toContain("paragraph_open");
	});
});
