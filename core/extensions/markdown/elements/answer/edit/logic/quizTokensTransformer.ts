import type TokenTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/TokenTransformerFunc";
import type { Token } from "@ext/markdown/core/render/logic/Markdoc";
import { answerTypeByQuestionType } from "@ext/markdown/elements/question/edit/logic/answerTypeByQuestionType";
import type { QuestionType } from "@ext/markdown/elements/question/types";

const getAttrs = (token) => {
	if (!token.attrs) return {};
	if (Array.isArray(token.attrs) && Array.isArray(token.attrs[0])) {
		const entries = token.attrs;
		return Object.fromEntries(entries);
	}
	return token.attrs || {};
};

interface QuizTokenIndex {
	answerIndexesByQuestion: Map<number, number[]>;
	questionIndexByAnswer: Map<number, number>;
	uniqueIdByToken: Map<number, string>;
}

// A copied question or answer keeps its id in the markdown, and old answers may have none.
// The reader keys selections by these ids, so every duplicate or missing one gets a stable fallback.
const getUniqueIds = (tokens: Token[], answerIndexesByQuestion: Map<number, number[]>): Map<number, string> => {
	const uniqueIdByToken = new Map<number, string>();
	const used = new Set<string>();
	const reserved = new Set<string>();
	answerIndexesByQuestion.forEach((answerIndexes, questionIndex) => {
		for (const index of [questionIndex, ...answerIndexes]) {
			const id = getAttrs(tokens[index])[index === questionIndex ? "id" : "answerId"];
			if (typeof id === "string" && id) reserved.add(id);
		}
	});

	const take = (tokenIndex: number, id: unknown, fallback: string) => {
		const ownId = typeof id === "string" && id ? id : null;
		let uniqueId = ownId && !used.has(ownId) ? ownId : null;
		for (let n = 1; !uniqueId; n++) {
			const candidate = `${ownId ?? fallback}-${n}`;
			if (!used.has(candidate) && !reserved.has(candidate)) uniqueId = candidate;
		}
		used.add(uniqueId);
		uniqueIdByToken.set(tokenIndex, uniqueId);
		return uniqueId;
	};

	answerIndexesByQuestion.forEach((answerIndexes, questionIndex) => {
		const questionId = take(questionIndex, getAttrs(tokens[questionIndex]).id, "question");
		for (const answerIndex of answerIndexes) {
			take(answerIndex, getAttrs(tokens[answerIndex]).answerId, `${questionId}-answer`);
		}
	});

	return uniqueIdByToken;
};

const quizTokenIndexes = new WeakMap<Token[], QuizTokenIndex>();

const getQuizTokenIndex = (tokens: Token[]): QuizTokenIndex => {
	const cached = quizTokenIndexes.get(tokens);
	if (cached) return cached;

	const answerIndexesByQuestion = new Map<number, number[]>();
	const questionIndexByAnswer = new Map<number, number>();
	const questionStack: number[] = [];

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token.type === "question_open") {
			questionStack.push(index);
			answerIndexesByQuestion.set(index, []);
		} else if (token.type === "question_close") {
			questionStack.pop();
		} else if (token.type === "questionAnswer_open") {
			const questionIndex = questionStack.at(-1);
			if (questionIndex !== undefined) {
				questionIndexByAnswer.set(index, questionIndex);
				answerIndexesByQuestion.get(questionIndex)?.push(index);
			}
		}
	}

	const index = {
		answerIndexesByQuestion,
		questionIndexByAnswer,
		uniqueIdByToken: getUniqueIds(tokens, answerIndexesByQuestion),
	};
	quizTokenIndexes.set(tokens, index);
	return index;
};

const quizTokensTransformer: TokenTransformerFunc = ({ token, tokens, id }) => {
	if (token.type === "questionAnswer_open") {
		const attrs = getAttrs(token);
		const quizTokenIndex = getQuizTokenIndex(tokens);
		const questionIndex = quizTokenIndex.questionIndexByAnswer.get(id);

		if (questionIndex === undefined) return;
		const parent = tokens[questionIndex];
		const parentAttrs = getAttrs(parent);
		const textToken = tokens[id + 2];
		const type = answerTypeByQuestionType[parentAttrs.type as QuestionType];
		const isNullAnswers = parentAttrs.isNullAnswers;

		const correctValue = type !== "text" ? (isNullAnswers ? null : attrs.correct === "true") : null;

		return {
			...token,
			attrs: {
				...attrs,
				answerId: quizTokenIndex.uniqueIdByToken.get(id),
				title: type !== "text" ? textToken?.content : "",
				type,
				questionId: quizTokenIndex.uniqueIdByToken.get(questionIndex),
				correct: correctValue,
			},
		};
	}

	if (token.type === "question_open") {
		const attrs = getAttrs(token);
		const textToken = tokens[id + 2];

		const quizTokenIndex = getQuizTokenIndex(tokens);
		const answerIndexes = quizTokenIndex.answerIndexesByQuestion.get(id) ?? [];
		const questionId = quizTokenIndex.uniqueIdByToken.get(id) ?? attrs.id;
		let hasCorrectAnswers = false;

		for (const answerIndex of answerIndexes) {
			const answerToken = tokens[answerIndex];
			const attrs = getAttrs(answerToken);
			if (attrs.correct === "true" || attrs.correct === true) {
				hasCorrectAnswers = true;
				break;
			}
		}

		tokens[id] = {
			...token,
			attrs: {
				...attrs,
				id: questionId,
				isNullAnswers: !hasCorrectAnswers,
			},
		};

		return {
			...token,
			attrs: {
				...attrs,
				id: questionId,
				title: textToken?.content,
				isNullAnswers: !hasCorrectAnswers,
				required: attrs.required === "true",
			},
		};
	}
};

export default quizTokensTransformer;
