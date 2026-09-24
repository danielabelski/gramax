import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { type Healthchecker, type HealthcheckResult, HealthcheckStatus, ModuleState } from "./HealthChecker";
import type { HealthcheckRegistry } from "./HealthCheckRegistry";
import type { ReadContentHealthState } from "./ReadContentHealthState";

const REFRESH_INTERVAL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const STALE_AFTER_MS = 15 * 60_000;

type WorkspaceSnapshot = {
	available: boolean;
	checkedAt: Date;
	catalogs?: number;
};

export class ReadContentHealthchecker implements Healthchecker {
	readonly name = "read-content";
	readonly critical = true;
	private _snapshot?: WorkspaceSnapshot;
	private _refreshing?: Promise<void>;
	private _started = false;

	constructor(
		private readonly _workspaceManager: WorkspaceManager,
		private readonly _state: ReadContentHealthState,
		registry?: HealthcheckRegistry,
		private readonly _now: () => number = Date.now,
	) {
		registry?.register(this);
	}

	async check(): Promise<HealthcheckResult> {
		if (!this._started) {
			this._started = true;
			void this._start();
		}
		if (!this._snapshot) return this._result(HealthcheckStatus.UNHEALTHY, "CONTENT_CHECK_INITIALIZING");
		if (this._now() - this._snapshot.checkedAt.getTime() > STALE_AFTER_MS) {
			return this._result(HealthcheckStatus.UNHEALTHY, "HEALTH_DATA_STALE", this._snapshot.checkedAt);
		}
		if (!this._snapshot.available) {
			return this._result(HealthcheckStatus.UNHEALTHY, "CONTENT_UNAVAILABLE", this._snapshot.checkedAt);
		}
		return this._state.snapshot(this._snapshot.checkedAt, this._snapshot.catalogs);
	}

	async refresh(): Promise<void> {
		if (this._refreshing) return await this._refreshing;
		this._refreshing = this._refresh();
		try {
			await this._refreshing;
		} finally {
			this._refreshing = undefined;
		}
	}

	private async _start(): Promise<void> {
		const timer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
		timer.unref?.();
		await this.refresh();
	}

	private async _refresh(): Promise<void> {
		try {
			const catalogs = await this._withTimeout(async () => {
				const workspace = this._workspaceManager.current();
				await workspace.config();
				return workspace.getAllCatalogs().size;
			});
			this._snapshot = { available: true, checkedAt: new Date(this._now()), catalogs };
		} catch {
			this._snapshot = { available: false, checkedAt: new Date(this._now()) };
		}
	}

	private async _withTimeout<T>(action: () => Promise<T>): Promise<T> {
		let timer: ReturnType<typeof setTimeout>;
		try {
			return await Promise.race([
				action(),
				new Promise<T>((_, reject) => {
					timer = setTimeout(() => reject(new Error("timeout")), REQUEST_TIMEOUT_MS);
				}),
			]);
		} finally {
			clearTimeout(timer);
		}
	}

	private _result(status: HealthcheckStatus, code: string, checkedAt = new Date(this._now())): HealthcheckResult {
		return {
			state: ModuleState.ENABLED,
			status,
			critical: this.critical,
			code,
			checkedAt,
		};
	}
}
