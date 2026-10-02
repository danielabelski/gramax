import { agentConfig } from "../../core/agentConfig";
import { RegexSafety } from "./regexSafety";

export type LineMatch = { line: number; text: string; endLine?: number; endText?: string };

export type ContentMatcher = (content: string, fromOffset: number) => { start: number; end: number } | null;

export type LineRangeInput = { fromLine?: number; toLine?: number };

export type LineRangeSlice = { content: string; fromLine: number; toLine: number; totalLines: number };

export class LineMatcher {
	static build(query: string, regex: boolean): ContentMatcher {
		if (query.length > agentConfig.searchQueryMaxChars) {
			throw new Error(`query must not be longer than ${agentConfig.searchQueryMaxChars} characters`);
		}

		if (regex) RegexSafety.assertNoNestedQuantifiers(query);

		const pattern = new RegExp(regex ? query : LineMatcher._escapeRegExp(query), "gim");

		return (content, fromOffset) => {
			pattern.lastIndex = fromOffset;
			const match = pattern.exec(content);
			if (!match) return null;
			return { start: match.index, end: match.index + match[0].length };
		};
	}

	static findAll(content: string, matcher: ContentMatcher, maxMatches: number): LineMatch[] {
		const matches: LineMatch[] = [];
		if (maxMatches < 1) return matches;

		const lineStarts = LineMatcher._buildLineStarts(content);
		let offset = 0;
		let lastLine = 0;

		while (matches.length < maxMatches && offset <= content.length) {
			const found = matcher(content, offset);
			if (!found) break;

			const line = LineMatcher._lineAt(lineStarts, found.start);
			if (line !== lastLine) {
				matches.push(LineMatcher._buildMatch(content, lineStarts, line, found));
				lastLine = line;
			}

			offset = Math.max(found.end, found.start + 1);
		}

		return matches;
	}

	private static _escapeRegExp(source: string): string {
		return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	private static _buildMatch(
		content: string,
		lineStarts: number[],
		line: number,
		found: { start: number; end: number },
	): LineMatch {
		const text = LineMatcher._lineTextAround(content, lineStarts, line, found.start);
		const lastOffset = Math.max(found.start, found.end - 1);
		const endLine = LineMatcher._lineAt(lineStarts, lastOffset);
		if (endLine === line) return { line, text };

		return {
			line,
			text,
			endLine,
			endText: LineMatcher._lineTextAround(content, lineStarts, endLine, lastOffset),
		};
	}

	private static _buildLineStarts(content: string): number[] {
		const starts = [0];
		for (let i = content.indexOf("\n"); i !== -1; i = content.indexOf("\n", i + 1)) starts.push(i + 1);
		return starts;
	}

	private static _lineAt(lineStarts: number[], offset: number): number {
		let low = 0;
		let high = lineStarts.length - 1;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (lineStarts[mid] <= offset) low = mid;
			else high = mid - 1;
		}
		return low + 1;
	}

	private static _lineTextAround(content: string, lineStarts: number[], line: number, matchStart: number): string {
		const start = lineStarts[line - 1];
		const end = line < lineStarts.length ? lineStarts[line] - 1 : content.length;
		return LineMatcher._truncateAroundMatch(content.slice(start, end), matchStart - start);
	}

	private static _truncateAroundMatch(line: string, matchIndex: number): string {
		const { searchMatchLineMaxChars } = agentConfig;
		const trimmed = line.trim();
		if (trimmed.length <= searchMatchLineMaxChars) return trimmed;

		const half = Math.floor(searchMatchLineMaxChars / 2);
		const start = Math.max(0, matchIndex - half);
		const end = Math.min(line.length, start + searchMatchLineMaxChars);
		const head = start > 0 ? "…" : "";
		const tail = end < line.length ? "…" : "";

		return `${head}${line.slice(start, end).trim()}${tail}`;
	}
}

export class LineRange {
	static has(range: LineRangeInput): boolean {
		return LineRange.toLineNumber(range.fromLine, "fromLine") !== undefined;
	}

	static assertValid(range: LineRangeInput, headingId?: string): void {
		const fromLine = LineRange.toLineNumber(range.fromLine, "fromLine");
		const toLine = LineRange.toLineNumber(range.toLine, "toLine");

		if (toLine !== undefined && fromLine === undefined) throw new Error("toLine is set without fromLine");
		if (fromLine !== undefined && toLine !== undefined && toLine < fromLine)
			throw new Error("toLine must not be less than fromLine");
		if (fromLine !== undefined && headingId)
			throw new Error("fromLine/toLine and headingId are mutually exclusive — pass only one of them");
	}

	static apply(content: string, range: LineRangeInput): LineRangeSlice {
		const lines = content.split("\n");
		const totalLines = lines.length;
		const fromLine = LineRange.toLineNumber(range.fromLine, "fromLine") ?? 1;
		if (fromLine > totalLines)
			throw new Error(`fromLine ${fromLine} is past the end of the document (${totalLines})`);

		const toLine = Math.min(LineRange.toLineNumber(range.toLine, "toLine") ?? totalLines, totalLines);

		return { content: lines.slice(fromLine - 1, toLine).join("\n"), fromLine, toLine, totalLines };
	}

	static toLineNumber(value: unknown, name: string): number | undefined {
		if (value === undefined || value === null || value === "") return undefined;

		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be an integer starting from 1`);
		return parsed;
	}
}
