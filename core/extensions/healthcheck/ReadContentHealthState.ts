import type { PageProps } from "@components/Pages/models/Pages";
import type { ArticlePageOptions } from "@core/SitePresenter/types/ArticlePage";
import { type HealthcheckResult, HealthcheckStatus, ModuleState } from "./HealthChecker";

const UNHEALTHY_AFTER_FAILURES = 3;

export class ReadContentHealthState {
	private _consecutiveFailures = 0;
	private _lastSuccessAt?: Date;
	private _lastFailureAt?: Date;

	constructor(private readonly _now: () => number = Date.now) {}

	recordSuccess(): void {
		this._consecutiveFailures = 0;
		this._lastSuccessAt = new Date(this._now());
	}

	recordFailure(): void {
		this._consecutiveFailures++;
		this._lastFailureAt = new Date(this._now());
	}

	observe(page: PageProps, options?: ArticlePageOptions): void {
		if (options?.diff || options?.scope || (page.page === "article" && page.data.diff)) return;
		if (page.page === "home") {
			this.recordSuccess();
			return;
		}

		const errorCode = page.data.articleProps.errorCode;
		if (errorCode === 404 || errorCode === 403) return;
		if (errorCode && errorCode >= 500) {
			this.recordFailure();
			return;
		}
		this.recordSuccess();
	}

	snapshot(checkedAt: Date, catalogs?: number): HealthcheckResult {
		const status =
			this._consecutiveFailures === 0
				? HealthcheckStatus.HEALTHY
				: this._consecutiveFailures < UNHEALTHY_AFTER_FAILURES
					? HealthcheckStatus.DEGRADED
					: HealthcheckStatus.UNHEALTHY;
		const code =
			status === HealthcheckStatus.DEGRADED
				? "CONTENT_READ_ERRORS"
				: status === HealthcheckStatus.UNHEALTHY
					? "CONTENT_UNAVAILABLE"
					: undefined;

		return {
			state: ModuleState.ENABLED,
			status,
			critical: true,
			...(code ? { code } : {}),
			checkedAt,
			data: {
				consecutiveFailures: this._consecutiveFailures,
				...(catalogs === undefined ? {} : { catalogs }),
				...(this._lastSuccessAt ? { lastSuccessAt: this._lastSuccessAt.toISOString() } : {}),
				...(this._lastFailureAt ? { lastFailureAt: this._lastFailureAt.toISOString() } : {}),
			},
		};
	}
}
