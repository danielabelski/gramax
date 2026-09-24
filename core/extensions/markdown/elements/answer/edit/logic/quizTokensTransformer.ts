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
}

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

	const index = { answerIndexesByQuestion, questionIndexByAnswer };
	quizTokenIndexes.set(tokens, index);
	return index;
};

const quizTokensTransformer: TokenTransformerFunc = ({ token, tokens, id }) => {
	if (token.type === "questionAnswer_open") {
		const attrs = getAttrs(token);
		const questionIndex = getQuizTokenIndex(tokens).questionIndexByAnswer.get(id);

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
				title: type !== "text" ? textToken?.content : "",
				type,
				questionId: parentAttrs.id,
				correct: correctValue,
			},
		};
	}

	if (token.type === "question_open") {
		const attrs = getAttrs(token);
		const textToken = tokens[id + 2];

		const answerIndexes = getQuizTokenIndex(tokens).answerIndexesByQuestion.get(id) ?? [];
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
				isNullAnswers: !hasCorrectAnswers,
			},
		};

		return {
			...token,
			attrs: {
				...attrs,
				title: textToken?.content,
				isNullAnswers: !hasCorrectAnswers,
				required: attrs.required === "true",
			},
		};
	}
};

export default quizTokensTransformer;
