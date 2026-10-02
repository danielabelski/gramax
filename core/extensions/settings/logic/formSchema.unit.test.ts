import { Level as OtelLogLevel } from "@ext/loggers/opentelemetry/span";
import { createAppSettingsFormSchema } from "./formSchema";

// GES states a service it deliberately doesn't use as `{ url: null }`
// (see app/utils/resolveWorkspaceServices.ts); that `null` can reach the
// app settings form's default values unchanged and must not block saving.
describe("createAppSettingsFormSchema", () => {
	const baseData = {
		general: { language: "en", theme: "light" },
		"compress-images": { enabled: false, rules: [] },
		logging: { level: OtelLogLevel.Off, console: false },
		contentCompare: { sensitivity: "hybrid", minSimilarity: 0.5, debounce: 100, minMatchLength: 3 },
	} as const;

	it("accepts a null service endpoint instead of rejecting it as an invalid URL", () => {
		const schema = createAppSettingsFormSchema();
		const result = schema.safeParse({
			...baseData,
			services: { "git-proxy": { endpoint: null } },
		});
		expect(result.success).toBe(true);
	});

	it("still rejects a genuinely malformed endpoint", () => {
		const schema = createAppSettingsFormSchema();
		const result = schema.safeParse({
			...baseData,
			services: { "git-proxy": { endpoint: "not-a-url" } },
		});
		expect(result.success).toBe(false);
	});
});
