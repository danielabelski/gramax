import type MarkdownIt from "markdown-it/lib";

export const OPEN = "<<<<<<<";
const MID = "=======";
const CLOSE = ">>>>>>>";

export function gitConflictPlugin(md: MarkdownIt) {
	function block(state, startLine, endLine, silent) {
		const start = state.bMarks[startLine] + state.tShift[startLine];
		const firstLine = state.src.slice(start, state.eMarks[startLine]);

		if (!firstLine.startsWith(OPEN)) {
			return false;
		}

		let nextLine = startLine + 1;
		let foundMid = false;
		let foundEnd = false;

		while (nextLine < endLine) {
			const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
			const lineEnd = state.eMarks[nextLine];
			const line = state.src.slice(lineStart, lineEnd);

			if (line.startsWith(MID)) {
				foundMid = true;
			} else if (line.startsWith(CLOSE)) {
				foundEnd = true;
				break;
			}

			nextLine++;
		}

		if (!foundMid || !foundEnd) {
			return false;
		}

		if (silent) {
			return true;
		}

		const contentStart = state.bMarks[startLine];
		const content = state.src.slice(contentStart, state.eMarks[nextLine]);

		// A conflict is the raw text of a file mid-merge, not markdown: markers and both versions
		// must keep their own lines. As a paragraph the lines collapsed into one on every render.
		const token = state.push("fence", "code", 0);
		token.content = `${content}\n`;
		token.info = "";
		token.markup = "";
		token.meta = { gitConflict: true };
		token.map = [startLine, nextLine + 1];

		state.line = nextLine + 1;

		return true;
	}

	md.block.ruler.before("annotations", "git_conflict", block, {
		alt: ["paragraph", "reference", "blockquote", "list"],
	});
}
