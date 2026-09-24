import quizTokensTransformer from "@ext/markdown/elements/answer/edit/logic/quizTokensTransformer";

describe("quizTokensTransformer", () => {
	test("associates answers with their question and preserves correct-answer semantics", () => {
		const tokens = [
			{ type: "question_open", attrs: { id: "first", type: "one", required: "true" } },
			{ type: "paragraph_open" },
			{ type: "text", content: "First question" },
			{ type: "questionAnswer_open", attrs: { correct: "true" } },
			{ type: "paragraph_open" },
			{ type: "text", content: "First answer" },
			{ type: "questionAnswer_close" },
			{ type: "question_close" },
			{ type: "question_open", attrs: { id: "second", type: "many" } },
			{ type: "paragraph_open" },
			{ type: "text", content: "Second question" },
			{ type: "questionAnswer_open", attrs: { correct: "false" } },
			{ type: "paragraph_open" },
			{ type: "text", content: "Second answer" },
			{ type: "questionAnswer_close" },
			{ type: "question_close" },
		];
		const transformer = {} as never;

		const firstQuestion = quizTokensTransformer({ token: tokens[0], tokens, id: 0, transformer });
		const firstAnswer = quizTokensTransformer({ token: tokens[3], tokens, id: 3, transformer });
		const secondQuestion = quizTokensTransformer({ token: tokens[8], tokens, id: 8, transformer });
		const secondAnswer = quizTokensTransformer({ token: tokens[11], tokens, id: 11, transformer });

		expect(firstQuestion.attrs).toEqual({
			id: "first",
			type: "one",
			required: true,
			title: "First question",
			isNullAnswers: false,
		});
		expect(firstAnswer.attrs).toMatchObject({
			questionId: "first",
			title: "First answer",
			type: "radio",
			correct: true,
		});
		expect(secondQuestion.attrs).toMatchObject({
			id: "second",
			title: "Second question",
			isNullAnswers: true,
		});
		expect(secondAnswer.attrs).toMatchObject({
			questionId: "second",
			title: "Second answer",
			type: "checkbox",
			correct: null,
		});
	});
});
