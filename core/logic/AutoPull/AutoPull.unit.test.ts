import type Application from "@app/types/Application";
import { HealthcheckStatus, ModuleState } from "@ext/healthcheck/HealthChecker";
import type Logger from "@ext/loggers/Logger";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import {
	AutoPull,
	type AutoPullState,
	getAutoPullSourceData,
	getWebhookSourceData,
	resolveAutoPullIntervalMs,
} from "./AutoPull";
import { AutoPullHealthchecker } from "./AutoPullHealthchecker";

const checkHealth = async (autoPull: AutoPull) => await new AutoPullHealthchecker(autoPull).check();
const setState = (autoPull: AutoPull, state: Partial<AutoPullState>) =>
	Reflect.set(autoPull, "_state", { ...autoPull.getState(), ...state });

describe("resolveAutoPullIntervalMs", () => {
	it("disables the timer for a negative interval", () => {
		expect(resolveAutoPullIntervalMs("-1")).toBeNull();
		expect(resolveAutoPullIntervalMs("-0.5")).toBeNull();
	});

	it("uses the configured interval in ms", () => {
		expect(resolveAutoPullIntervalMs("60")).toBe(60_000);
	});

	it("falls back to the default for unset, zero, or non-numeric values", () => {
		expect(resolveAutoPullIntervalMs(undefined)).toBe(180_000);
		expect(resolveAutoPullIntervalMs("0")).toBe(180_000);
		expect(resolveAutoPullIntervalMs("abc")).toBe(180_000);
	});

	it("caps the interval at the setTimeout limit so it never wraps to an immediate hot loop", () => {
		expect(resolveAutoPullIntervalMs("86400")).toBe(86_400_000);
		expect(resolveAutoPullIntervalMs(String(Number.MAX_SAFE_INTEGER))).toBe(2 ** 31 - 1);
	});
});

describe("AutoPull cycle scheduling", () => {
	const originalToken = process.env.AUTO_PULL_TOKEN;
	const originalInterval = process.env.AUTO_PULL_INTERVAL;
	const originalDelay = process.env.AUTO_PULL_DELAY;

	const logger = {
		logInfo: jest.fn(),
		logWarning: jest.fn(),
		logError: jest.fn(),
		logTrace: jest.fn(),
		ln: jest.fn(),
		setLogLevel: jest.fn(),
	} as unknown as Logger;

	beforeEach(() => {
		jest.useFakeTimers();
		process.env.AUTO_PULL_TOKEN = "token";
		process.env.AUTO_PULL_INTERVAL = "60";
		process.env.AUTO_PULL_DELAY = "1";
	});

	afterEach(() => {
		jest.useRealTimers();
		process.env.AUTO_PULL_TOKEN = originalToken;
		process.env.AUTO_PULL_INTERVAL = originalInterval;
		process.env.AUTO_PULL_DELAY = originalDelay;
	});

	// `wm.current()` throws NoActiveWorkspace when no workspace is selected. A throw used to skip the
	// re-arm at the tail of the pull loop and kill auto-pull until the process restarted.
	it("keeps scheduling cycles after a failing one", async () => {
		const current = jest
			.fn()
			.mockImplementationOnce(() => {
				throw new Error("no active workspace");
			})
			.mockImplementation(() => ({ getAllCatalogs: () => new Map() }));
		const app = Promise.resolve({ logger, wm: { current } as unknown as WorkspaceManager } as Application);

		const autoPull = new AutoPull();
		await autoPull.start(app);
		await jest.advanceTimersByTimeAsync(0);
		expect(current).toHaveBeenCalledTimes(1);
		expect(await checkHealth(autoPull)).toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "AUTO_PULL_FAILED",
		});

		await jest.advanceTimersByTimeAsync(60_000);
		expect(current).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(60_000);
		expect(current).toHaveBeenCalledTimes(3);
	});
});

describe("AutoPull health", () => {
	const originalToken = process.env.AUTO_PULL_TOKEN;
	const originalInterval = process.env.AUTO_PULL_INTERVAL;
	const logger = { logInfo: jest.fn(), logWarning: jest.fn() } as unknown as Logger;
	const app = () =>
		Promise.resolve({
			logger,
			wm: { current: () => ({ getAllCatalogs: () => new Map() }) } as unknown as WorkspaceManager,
		} as Application);

	beforeEach(() => jest.useFakeTimers());

	afterEach(() => {
		jest.useRealTimers();
		process.env.AUTO_PULL_TOKEN = originalToken;
		process.env.AUTO_PULL_INTERVAL = originalInterval;
	});

	it("reports disabled when AUTO_PULL_TOKEN is absent", async () => {
		delete process.env.AUTO_PULL_TOKEN;
		const autoPull = new AutoPull();

		await autoPull.start(app());

		expect(await checkHealth(autoPull)).toMatchObject({ state: ModuleState.DISABLED, critical: false });
		expect((await checkHealth(autoPull)).status).toBeUndefined();
	});

	it("reports webhook-only for a negative interval", async () => {
		process.env.AUTO_PULL_TOKEN = "token";
		process.env.AUTO_PULL_INTERVAL = "-1";
		const autoPull = new AutoPull();

		await autoPull.start(app());

		expect(await checkHealth(autoPull)).toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.HEALTHY,
			data: { mode: "webhook-only" },
		});
	});

	it("reports stale when the scheduled cycle has not run for two intervals", async () => {
		process.env.AUTO_PULL_TOKEN = "token";
		process.env.AUTO_PULL_INTERVAL = "60";
		const autoPull = new AutoPull();
		await autoPull.start(app());
		await jest.advanceTimersByTimeAsync(0);

		jest.setSystemTime(Date.now() + 120_001);

		expect(await checkHealth(autoPull)).toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "AUTO_PULL_STALE",
		});
	});

	it("reports safe names of failed catalogs", async () => {
		const autoPull = new AutoPull();
		setState(autoPull, {
			mode: "interval",
			lastSummary: {
				total: 2,
				pulled: 1,
				upToDate: 0,
				skipped: 0,
				failed: 1,
				failedCatalogs: ["broken"],
			},
		});

		expect(await checkHealth(autoPull)).toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "AUTO_PULL_FAILED",
			data: { failedCatalogs: ["broken"] },
		});
	});

	it("reports waiting before the first cycle completes", async () => {
		const autoPull = new AutoPull();
		setState(autoPull, { mode: "interval" });

		expect(await checkHealth(autoPull)).toMatchObject({
			status: HealthcheckStatus.HEALTHY,
			data: { mode: "interval", phase: "waiting" },
		});
	});

	it("does not report waiting after a failed attempt", async () => {
		const autoPull = new AutoPull();
		setState(autoPull, { mode: "interval", lastAttemptAt: Date.now(), lastCycleFailed: true });

		const result = await checkHealth(autoPull);
		expect(result.code).toBe("AUTO_PULL_FAILED");
		expect(result.data?.phase).toBeUndefined();
	});

	it("reports an initialization failure", async () => {
		const autoPull = new AutoPull();

		autoPull.markStartFailed();

		expect(await checkHealth(autoPull)).toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "AUTO_PULL_INIT_FAILED",
		});
	});
});

describe("getAutoPullSourceData", () => {
	const originalToken = process.env.AUTO_PULL_TOKEN;
	const originalUsername = process.env.AUTO_PULL_USERNAME;

	afterEach(() => {
		process.env.AUTO_PULL_TOKEN = originalToken;
		process.env.AUTO_PULL_USERNAME = originalUsername;
	});

	it("returns null without token", () => {
		delete process.env.AUTO_PULL_TOKEN;

		expect(getAutoPullSourceData("git.example.com", SourceType.git)).toBeNull();
	});

	it("builds source data from auto-pull env", () => {
		process.env.AUTO_PULL_TOKEN = "token";
		process.env.AUTO_PULL_USERNAME = "bot";

		const sourceData = getAutoPullSourceData("git.example.com", SourceType.git);

		expect(sourceData?.sourceType).toBe(SourceType.git);
		expect(sourceData?.domain).toBe("git.example.com");
		expect(sourceData?.userName).toBe("autopull");
		expect(sourceData?.gitServerUsername).toBe("bot");
		expect(sourceData?.userEmail).toBe("autopull");
		expect(sourceData?.token).toBe("token");
	});
});

describe("getWebhookSourceData", () => {
	const originalAutoPullToken = process.env.AUTO_PULL_TOKEN;
	const originalWebhookToken = process.env.WEBHOOK_TOKEN;

	afterEach(() => {
		process.env.AUTO_PULL_TOKEN = originalAutoPullToken;
		process.env.WEBHOOK_TOKEN = originalWebhookToken;
	});

	it("returns null when neither WEBHOOK_TOKEN nor AUTO_PULL_TOKEN is set", () => {
		delete process.env.WEBHOOK_TOKEN;
		delete process.env.AUTO_PULL_TOKEN;

		expect(getWebhookSourceData("git.example.com", SourceType.git)).toBeNull();
	});

	it("prefers WEBHOOK_TOKEN over AUTO_PULL_TOKEN", () => {
		process.env.AUTO_PULL_TOKEN = "auto-pull-token";
		process.env.WEBHOOK_TOKEN = "webhook-token";

		const sourceData = getWebhookSourceData("git.example.com", SourceType.git);

		expect(sourceData?.token).toBe("webhook-token");
		expect(sourceData?.sourceType).toBe(SourceType.git);
	});

	it("falls back to AUTO_PULL_TOKEN when WEBHOOK_TOKEN is unset", () => {
		delete process.env.WEBHOOK_TOKEN;
		process.env.AUTO_PULL_TOKEN = "auto-pull-token";

		const sourceData = getWebhookSourceData("git.example.com", SourceType.git);

		expect(sourceData?.token).toBe("auto-pull-token");
		expect(sourceData?.sourceType).toBe(SourceType.git);
	});
});
