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

describe("quizTokensTransformer ids", () => {
	const transform = (tokens: { type: string; attrs?: Record<string, string>; content?: string }[]) =>
		tokens.map((token, id) => quizTokensTransformer({ token, tokens, id, transformer: {} as never }));

	const answer = (attrs: Record<string, string>, text: string) => [
		{ type: "questionAnswer_open", attrs },
		{ type: "paragraph_open" },
		{ type: "text", content: text },
		{ type: "questionAnswer_close" },
	];

	test("gives copied answers their own ids", () => {
		const tokens = [
			{ type: "question_open", attrs: { id: "q", type: "one" } },
			...answer({ answerId: "a", correct: "true" }, "First"),
			...answer({ answerId: "a" }, "Second"),
			...answer({ answerId: "a" }, "Third"),
			...answer({ answerId: "a-1" }, "Fourth"),
			{ type: "question_close" },
		];

		const answerIds = transform(tokens)
			.filter((token) => token?.type === "questionAnswer_open")
			.map((token) => token.attrs.answerId);

		expect(answerIds[0]).toBe("a");
		expect(answerIds[3]).toBe("a-1");
		expect(new Set(answerIds).size).toBe(4);
	});

	test("gives answers without an id their own ids", () => {
		const tokens = [
			{ type: "question_open", attrs: { id: "q", type: "many" } },
			...answer({}, "First"),
			...answer({}, "Second"),
			{ type: "question_close" },
		];

		const answerIds = transform(tokens)
			.filter((token) => token?.type === "questionAnswer_open")
			.map((token) => token.attrs.answerId);

		expect(answerIds.every(Boolean)).toBe(true);
		expect(new Set(answerIds).size).toBe(2);
		expect(transform(tokens).find((t) => t?.type === "questionAnswer_open").attrs.answerId).toBe(answerIds[0]);
	});

	test("gives a copied question its own id and links its answers to it", () => {
		const tokens = [
			{ type: "question_open", attrs: { id: "q", type: "one" } },
			...answer({ answerId: "a" }, "First"),
			{ type: "question_close" },
			{ type: "question_open", attrs: { id: "q", type: "one" } },
			...answer({ answerId: "a" }, "First"),
			{ type: "question_close" },
		];

		const result = transform(tokens);
		const questionIds = [result[0].attrs.id, result[6].attrs.id];

		expect(questionIds[0]).toBe("q");
		expect(questionIds[1]).not.toBe("q");
		expect(result[1].attrs.questionId).toBe("q");
		expect(result[7].attrs.questionId).toBe(questionIds[1]);
		expect(result[7].attrs.answerId).not.toBe(result[1].attrs.answerId);
	});
});
