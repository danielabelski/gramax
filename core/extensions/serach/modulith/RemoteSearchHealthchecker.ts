import {
	type Healthchecker,
	type HealthcheckResult,
	HealthcheckStatus,
	ModuleState,
} from "@ext/healthcheck/HealthChecker";
import type { RemoteModulithSearchClient } from "@ext/serach/modulith/search/RemoteModulithSearchClient";

const REFRESH_INTERVAL_MS = 30_000;
const SNAPSHOT_STALE_AFTER_MS = 90_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class RemoteSearchHealthchecker implements Healthchecker {
	readonly name = "remote-search";
	readonly critical = false;
	private _snapshot?: { result: HealthcheckResult; refreshedAt: number };
	private _refreshing?: Promise<void>;
	private _started = false;

	constructor(private readonly _client: RemoteModulithSearchClient) {}

	async check(): Promise<HealthcheckResult> {
		if (!this._started) {
			this._started = true;
			void this._start();
		}

		if (!this._snapshot) return this._initializingResult();
		if (Date.now() - this._snapshot.refreshedAt > SNAPSHOT_STALE_AFTER_MS) return this._staleResult();

		return this._snapshot.result;
	}

	private async _start(): Promise<void> {
		const timer = setInterval(() => void this._refresh(), REFRESH_INTERVAL_MS);
		timer.unref?.();
		await this._refresh();
	}

	private async _refresh(): Promise<void> {
		if (this._refreshing) return await this._refreshing;
		this._refreshing = this._performRefresh();
		try {
			await this._refreshing;
		} finally {
			this._refreshing = undefined;
		}
	}

	private async _performRefresh(): Promise<void> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			const response = await this._client.healthcheck(controller.signal);
			this._snapshot = {
				result: response.ok === true ? this._healthyResult() : this._unhealthyResult(),
				refreshedAt: Date.now(),
			};
		} catch {
			this._snapshot = { result: this._unhealthyResult(), refreshedAt: Date.now() };
		} finally {
			clearTimeout(timer);
		}
	}

	private _initializingResult(): HealthcheckResult {
		return {
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.DEGRADED,
			critical: false,
			code: "REMOTE_SEARCH_INITIALIZING",
		};
	}

	private _staleResult(): HealthcheckResult {
		return {
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "HEALTH_DATA_STALE",
		};
	}

	private _healthyResult(): HealthcheckResult {
		return {
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.HEALTHY,
			critical: false,
		};
	}

	private _unhealthyResult(): HealthcheckResult {
		return {
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "REMOTE_SEARCH_UNREACHABLE",
		};
	}
}
