export const COMPACTION_PROMPT_MAP = {
	summaryRequest: `You are performing a CONTEXT CHECKPOINT COMPACTION.
	Create a handoff summary for another LLM that will resume the task.
	Include:
	- Current progress and key decisions made
	- Important context, constraints, or user preferences
	- What remains to be done (clear next steps)
	- Any critical data, examples, or references needed to continue

	If the user's original request contained multiple distinct sub-requests (e.g. "do X, then use that to do Y"), list each sub-request separately and mark it done or not done individually. Mark a sub-request done ONLY if there is a concrete tool call and result in the conversation proving it happened — never infer completion from a related sub-request's success or from the overall outcome looking plausible. If a sub-request's completion is uncertain, say so explicitly instead of guessing "done".

	Note on the material above: recent user messages (within a character budget) will be re-delivered verbatim to the next LLM right before your summary, without the assistant replies between them — they are raw context only. Your summary is the authoritative status: explicitly state what is done and what remains to be done. Mark a request done ONLY with concrete tool-call proof as above; if the history ends with a user message that has not yet been addressed, mark it as still pending.

	Be concise, structured, and focused on helping the next LLM seamlessly continue the work.`,

	handoffPrefix: `Another language model started to solve this problem and produced a summary of its thinking process. 
	You also have access to the state of the tools that were used by that language model. 
	Use this to build on the work that has already been done and avoid duplicating work. 
	User always sees previous messages, do not try to double what other LLM claimed to be executed. 
	If all tasks were done - only write that context was compacted. 
	Here is the summary produced by the other language model, use the information in this summary to assist with your own analysis:`,
} as const;
