import type TokenTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/TokenTransformerFunc";
import type { JSONContent } from "@tiptap/core";
import type { Schema as ProsemirrorSchema } from "prosemirror-model";
import type { ParserOptions } from "../../../Parser/Parser";
import type PrivateParserContext from "../../../Parser/ParserContext/PrivateParserContext";
import { type RenderableTreeNodes, type Schema, SchemaType, Tag } from "../../../render/logic/Markdoc";
import { getMarkdocFormatter } from "../Formatter/Formatters/getMarkdocFormatter";
import type NodeTransformerFunc from "./NodeTransformerFunc";

// biome-ignore lint/suspicious/noExplicitAny: token type is not yet defined
type Token = any;

export class Transformer {
	private readonly _firstPassTransformers: TokenTransformerFunc[];
	private readonly _secondPassTransformers: TokenTransformerFunc[];
	private readonly _markdocFormatters = new Map<string, ReturnType<typeof getMarkdocFormatter>>();

	constructor(
		private _schemes: Record<string, Schema>,
		private _nodeTransformerFuncs: NodeTransformerFunc[],
		tokenTransformerFuncs: TokenTransformerFunc[],
		private _context: PrivateParserContext,
		private _schema: ProsemirrorSchema,
	) {
		this._firstPassTransformers = [
			this._annotationTokenTransformer,
			this._variableTokenTransformer,
			this._tagTokenTransformer,
			...tokenTransformerFuncs,
		];
		this._secondPassTransformers = [
			this._openCloseTokenTransformer,
			...tokenTransformerFuncs,
			this._inlineTokenTransformer,
		];
	}

	async transformMdComponents(
		inputNode: JSONContent,
		renderer: (
			content: string,
			context?: PrivateParserContext,
			parserOptions?: ParserOptions,
		) => Promise<RenderableTreeNodes>,
	): Promise<JSONContent> {
		const renderJobs: Promise<void>[] = [];
		const root = { node: inputNode };

		const visit = (input: JSONContent): JSONContent => {
			let node = input;
			if (node?.content) node.content = node.content.map(visit);

			const inlineMd = node?.marks?.some((mark) => mark.type === "inlineMd");
			if (inlineMd) {
				const component = {
					type: "inlineMd_component",
					attrs: {
						...node.attrs,
						comment: { id: node.marks.find((mark) => mark.type === "comment")?.attrs.id },
						tag: undefined as RenderableTreeNodes,
						text: node.text,
					},
					marks: node.marks.filter((mark) => mark.type !== "comment" && mark.type !== "inlineMd"),
				};
				renderJobs.push(
					renderer(node.text, this._context, { isOneElement: true, isBlock: false }).then((tag) => {
						component.attrs.tag = tag;
					}),
				);
				node = component;
			}

			if (node.type === "blockMd") {
				renderJobs.push(
					renderer(node.attrs.text, this._context, { isOneElement: true, isBlock: true }).then((tag) => {
						node.attrs.tag = tag;
					}),
				);
			}
			return node;
		};

		root.node = visit(root.node);
		await Promise.all(renderJobs);
		return root.node;
	}

	async transformTree(
		node: JSONContent,
		previousNode?: JSONContent,
		nextNode?: JSONContent,
		count?: number,
	): Promise<JSONContent> {
		if (node?.content) {
			const newContent = [];
			for (let i = 0; i < node.content.length; i++) {
				const value = node.content[i];
				newContent.push(
					await this.transformTree(
						value,
						i === 0 ? null : node.content[i - 1],
						i === node.content.length - 1 ? null : node.content[i + 1],
						count + i + 1,
					),
				);
			}
			node.content = newContent.flat().filter((n) => n);
		}

		for (const nodeTransformerFunc of this._nodeTransformerFuncs) {
			const res = await nodeTransformerFunc(node, previousNode, nextNode, this._context, count);
			if (res?.isSet) return res.value;
		}

		return node;
	}

	transformToken(inputTokens: Token[]): Token[] {
		if (inputTokens.length === 0) {
			return [
				{ type: "paragraph_open", tag: "p" },
				{ type: "paragraph_close", tag: "p" },
			];
		}

		const generatedTokens = new WeakSet<object>();
		const firstPassTokens = this._transformTokens(inputTokens, this._firstPassTransformers, false, generatedTokens);
		return this._transformTokens(firstPassTokens, this._secondPassTransformers, true, generatedTokens);
	}

	private _transformTokens(
		tokens: Token[],
		transformerFuncs: TokenTransformerFunc[],
		isSecondPass: boolean,
		generatedTokens: WeakSet<object>,
	): Token[] {
		const transformedTokens: Token[] = [];
		for (let index = 0; index < tokens.length; index++) {
			const transformed = this._transformToken(
				tokens,
				index,
				tokens[index],
				index === 0 ? null : tokens[index - 1],
				undefined,
				transformerFuncs,
				isSecondPass,
				generatedTokens,
			);
			this._appendTokenResult(transformedTokens, transformed);
		}
		return transformedTokens;
	}

	private _appendTokenResult(target: Token[], result: Token | Token[]): void {
		if (Array.isArray(result)) {
			for (const token of result) {
				if (token) target.push(token);
			}
		} else if (result) {
			target.push(result);
		}
	}

	private _variableTokenTransformer: TokenTransformerFunc = ({ token, transformer }) => {
		if (token.type === "variable") return transformer.getInlineMdTokens(`{% ${token.info} %}`);
	};

	private _annotationTokenTransformer: TokenTransformerFunc = ({ token, transformer, parent }) => {
		if (token.type === "annotation") {
			if (parent?.type !== "inline") return transformer.getInlineMdTokens(`{${token.info}}`);
			if (!parent.attrs) parent.attrs = {};
			if (token.meta?.attributes)
				token.meta?.attributes.forEach(({ name, value }) => {
					parent.attrs[name] = value;
				});
			parent.attrs.info = token.info;
			return null;
		}
	};

	private _openCloseTokenTransformer: TokenTransformerFunc = ({ token, previous }) => {
		if (token?.type?.includes("_close") && previous?.type?.includes("_open")) {
			const tokenTypeName = token.type.match(/(.*?)_close/)?.[1];
			if (
				tokenTypeName &&
				tokenTypeName !== "tableRow" &&
				tokenTypeName !== "inlineHtmlTag" &&
				tokenTypeName === previous.type.match(/(.*?)_open/)?.[1]
			) {
				return [{ type: "paragraph_open", tag: "p" }, { type: "paragraph_close", tag: "p" }, token];
			}
		}
	};

	private _inlineTokenTransformer: TokenTransformerFunc = ({ token, transformer, previous }) => {
		if (token && token.type === "inline" && token.attrs) {
			if (previous.type !== "heading_open") {
				token.children.push(transformer.getInlineMdTokens(`{${token.attrs.info}}`));
			} else {
				if (!previous.attrs) previous.attrs = {};
				previous.attrs = { ...token.attrs, ...previous.attrs };
			}
		}
	};

	private static _tagAliases: Record<string, string> = {
		"snippet-link": "fragment-link",
		snippet: "fragment",
	};

	private _tagTokenTransformer: TokenTransformerFunc = ({ token, transformer, parent }) => {
		if (token.type === "tag" || token.type === "tag_open" || token.type === "tag_close") {
			const attrs: Record<string, unknown> = {};
			if (token.meta?.attributes)
				token.meta?.attributes.forEach(({ name, value }) => {
					attrs[name] = value;
				});
			const tagName = Transformer._tagAliases[token.meta.tag] ?? token.meta.tag;
			const newNode = {
				type: tagName,
				tag: tagName,
				attrs,
			};

			if (!this._schema.nodes?.[newNode.type] && !this._schema.marks?.[newNode.type]) {
				const nodeSchema = transformer._schemes[newNode.type];
				let formatter = this._markdocFormatters.get(tagName);
				if (!formatter) {
					formatter = getMarkdocFormatter(nodeSchema, this._context);
					this._markdocFormatters.set(tagName, formatter);
				}
				const tag = new Tag(newNode.type, newNode.attrs);

				if (token.type === "tag_open" && parent && parent.type === "inline") {
					const content = formatter(tag, "", false, true);
					return transformer.getInlineMdOpenTokens(content);
				}

				if (token.type === "tag_close" && parent && parent.type === "inline") {
					const content = formatter(tag, "", true);
					return transformer.getInlineMdCloseTokens(content);
				}

				if (
					nodeSchema.type === SchemaType.block ||
					(newNode.tag === "formula" && (newNode.attrs.content as string)?.includes("$$"))
				) {
					return { type: "blockMd", attrs: { text: formatter(tag, "") } };
				}
				if (!parent)
					return transformer.getParagraphTokens(null, transformer.getInlineMdTokens(formatter(tag, "")));
				return transformer.getInlineMdTokens(formatter(tag, ""));
			}

			if (token.type === "tag_open") newNode.type = `${newNode.type}_open`;
			if (token.type === "tag_close") newNode.type = `${newNode.type}_close`;

			if (transformer._schemes[newNode.type]?.type === SchemaType.block) {
				if (parent) return transformer.getBlockMdTokens(newNode);
			}

			return newNode;
		}
	};

	private _transformToken(
		tokens: Token[],
		id: number,
		inputToken: Token,
		previous?: Token,
		parent?: Token,
		transformerFuncs: TokenTransformerFunc[] = this._firstPassTransformers,
		isSecondPass = false,
		generatedTokens = new WeakSet<object>(),
	): Token | Token[] {
		let token = inputToken;
		for (const transformFunc of transformerFuncs) {
			if (
				isSecondPass &&
				this._isBuiltInSecondPassTransformer(transformFunc) &&
				!this._needsSecondPass(token, previous, generatedTokens)
			) {
				continue;
			}

			const result = transformFunc({ id, tokens, token, previous, parent, transformer: this });
			if (result !== undefined) {
				if (!isSecondPass) this._markGeneratedTokens(result, generatedTokens);
				token = result;
				return token;
			}
		}

		if (token?.children) {
			const children = token.children;
			const transformedChildren: Token[] = [];
			for (let index = 0; index < children.length; index++) {
				const transformed = this._transformToken(
					children,
					index,
					children[index],
					index === 0 ? null : children[index - 1],
					token,
					transformerFuncs,
					isSecondPass,
					generatedTokens,
				);
				this._appendTokenResult(transformedChildren, transformed);
			}
			token.children = transformedChildren;
		}

		return token;
	}

	private _needsSecondPass(token: Token, previous: Token, generatedTokens: WeakSet<object>): boolean {
		if (token && typeof token === "object" && generatedTokens.has(token)) return true;
		if (token?.type === "inline" && token.attrs) return true;
		return Boolean(token?.type?.includes("_close") && previous?.type?.includes("_open"));
	}

	private _isBuiltInSecondPassTransformer(transformer: TokenTransformerFunc): boolean {
		return transformer === this._openCloseTokenTransformer || transformer === this._inlineTokenTransformer;
	}

	private _markGeneratedTokens(result: Token | Token[], generatedTokens: WeakSet<object>): void {
		if (Array.isArray(result)) {
			for (const token of result) this._markGeneratedTokens(token, generatedTokens);
			return;
		}
		if (!result || typeof result !== "object") return;
		generatedTokens.add(result);
		if (result.children) this._markGeneratedTokens(result.children, generatedTokens);
	}

	public getParagraphTokens(content?: string, children?: Token[]) {
		return [
			{ type: "paragraph_open", tag: "p" },
			{
				type: "inline",
				tag: "",
				children: children ?? [...this.getInlineMdTokens(content)],
				content: content ?? "",
			},
			{ type: "paragraph_close", tag: "p" },
		];
	}

	public getTextToken(content: string) {
		return { type: "text", content };
	}

	public getInlineMdOpenTokens(content?: string) {
		const openToken = { type: "inlineMd_open", tag: "inlineMd" };
		if (!content) return openToken;
		return [openToken, this.getTextToken(content)];
	}

	public getInlineMdCloseTokens(content?: string) {
		const closeToken = { type: "inlineMd_close", tag: "inlineMd" };
		if (!content) return closeToken;
		return [this.getTextToken(content), closeToken];
	}

	public getInlineMdTokens(content: string) {
		return [this.getInlineMdOpenTokens(), this.getTextToken(content), this.getInlineMdCloseTokens()];
	}

	public getBlockMdTokens(children) {
		return [{ type: "blockMd_open", tag: "blockMd" }, children, { type: "blockMd_close", tag: "blockMd" }];
	}
}
