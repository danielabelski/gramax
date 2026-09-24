import { Level, traced } from "@ext/loggers/opentelemetry";
import type { PluginEventMap, PluginEventName } from "@gramax/sdk/events";
import { emitPluginEvent, waitForPluginsReady } from "@plugins/api/events";

type EventPayload<E extends PluginEventName> = Parameters<PluginEventMap[E]>[0];
// biome-ignore lint/suspicious/noConfusingVoidType: matches emitPluginEvent's public contract
type EmitPluginEvent<E extends PluginEventName> = (event: E, payload: EventPayload<E>) => Promise<void | boolean>;

export const executePluginGuardedAction = async <E extends PluginEventName, TResult>(
	event: E,
	payload: EventPayload<E>,
	action: () => Promise<TResult>,
	emit: EmitPluginEvent<E> = emitPluginEvent,
	waitForReady: () => Promise<void> = waitForPluginsReady,
): Promise<
	| { allowed: false; reason: "veto" }
	| { allowed: false; reason: "error"; error: unknown }
	| { allowed: true; result: TResult }
> => {
	try {
		const allowed = await traced(
			"execute-plugin-guard",
			{
				level: Level.Commands,
				args: [event, payload],
				omitResult: true,
			},
			async () => {
				await waitForReady();
				return await emit(event, payload);
			},
		);

		if (allowed === false) {
			return { allowed: false, reason: "veto" };
		}
	} catch (error) {
		return { allowed: false, reason: "error", error };
	}

	return { allowed: true, result: await action() };
};
