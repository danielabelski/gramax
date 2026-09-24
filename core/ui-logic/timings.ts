const DEFAULTS = {
	// How long the pointer must rest on an element before its tooltip opens. 300-500ms is the
	// range design systems settle on: long enough that crossing an element does not fire it,
	// short enough not to feel broken. E2E sets this to 0 -- it asserts the rendered tooltip,
	// not the passage of a human-facing wait.
	tooltipDelayMs: 500,
	// Same, for small elements inside dense lists (dates, authors, table handles):
	// the pointer crosses them all the time while the user scans the list.
	tooltipLongDelayMs: 1000,
	// Window after a tooltip closes during which the next one opens without waiting again.
	tooltipSkipDelayMs: 300,
	// Tooltips always hide immediately; kept named so call sites carry no bare numbers.
	tooltipHideDelayMs: 0,
};

export type TimingKey = keyof typeof DEFAULTS;

const cache = new Map<TimingKey, number>();

// E2E overrides a key via localStorage ("gx-timing-<key>") before the app loads. Read on first
// use rather than at module init, so the override applies to the load that follows it; cached
// because timing() sits in render paths. The catch also covers SSR, where `window` is undeclared.
export const timing = (key: TimingKey): number => {
	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	let value = DEFAULTS[key];
	try {
		const raw = window.localStorage.getItem(`gx-timing-${key}`);
		const override = raw === null ? NaN : Number(raw);
		if (Number.isFinite(override) && override >= 0) value = override;
	} catch {}

	cache.set(key, value);
	return value;
};

// Tiers a component may forward as a named prop. `satisfies` is what makes the mapping safe: rename
// a key in DEFAULTS and this errors here, at the definition, instead of rippling out to call sites.
const TIERS = {
	standard: "tooltipDelayMs",
	long: "tooltipLongDelayMs",
} as const satisfies Record<string, TimingKey>;

export type TooltipDelayTier = keyof typeof TIERS;

export const delayOf = (tier: TooltipDelayTier): number => timing(TIERS[tier]);

/**
 * Reads like a constant at the call site. A getter rather than a `const` only because e2e overrides
 * the value through localStorage, which a module-init constant would capture too early.
 */
export const tooltipDelay = {
	get standard(): number {
		return delayOf("standard");
	},
	get long(): number {
		return delayOf("long");
	},
	get skip(): number {
		return timing("tooltipSkipDelayMs");
	},
	get hide(): number {
		return timing("tooltipHideDelayMs");
	},
};
