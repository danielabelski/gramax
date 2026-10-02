import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.PLAYWRIGHT_CI;
const isDev = !!process.env.PLAYWRIGHT_DEV;

// Worktrees run side by side and each owns a port block, so a hardcoded 6001 means the second
// checkout silently drives the first one's app. CI keeps the default and stays as it was.
const webPort = Number(process.env.GX_E2E_WEB_PORT) || 6001;

/**
 * The stash cases that exist for their numbers rather than for a verdict: a sweep across catalog
 * sizes and a breakdown by operation. They are read by a person, and a person starts them.
 *
 * `command-measure` was a gating case at first — it carries a budget per section, so it could fail
 * on a regression instead of merely reporting one. It cannot gate from inside the MR pipeline: the
 * budgets are absolute wall-clock, and a job that lands next to another e2e run measures the
 * neighbour's load. It has reddened merge requests that changed nothing near it (!3764: `checkout`
 * at 3237 ms against 3150, in a run where every section cost about twice its usual), and its two
 * retries then fail on the UI instead, so all three attempts are lost. Here it still measures the
 * same fixture with the same budgets, on a job started by a person — which is where a number that
 * needs a quiet runner belongs.
 */
const MEASUREMENT_SPECS = ["**/stash-measure.spec.ts", "**/large-catalog.spec.ts", "**/command-measure.spec.ts"];
const webBaseURL = `${isDev ? "https" : "http"}://localhost:${webPort}`;

export default defineConfig({
	captureGitInfo: {
		commit: true,
		diff: true,
	},

	expect: {
		// CI shares a node with whatever else is running on it, and a suite that lands next to another
		// e2e job runs about twice as slow for no reason of its own. Thresholds here are wall-clock, so
		// a tight one turns someone else's load into a red build; locally nothing competes.
		timeout: isCI ? 15_000 : 7000,
	},

	// `checkout-stash*` drives a real checkout+stash-apply against a shared, budget-constrained CI
	// node; retries already absorb the occasional slow one, but failing the whole 470-test job on a
	// single test that passed on its second try is a stricter bar than that suite can clear. Jobs
	// that don't carry that risk keep the strict default.
	failOnFlakyTests: isCI && !process.env.PLAYWRIGHT_ALLOW_FLAKY,

	// Fails fast when the GitLab token is unusable, instead of letting every git spec fail its own way.
	globalSetup: "./global-setup.ts",

	// Sweeps GitLab temp repos this run left behind.
	globalTeardown: "./global-teardown.ts",

	outputDir: "./report",

	// Run all tests in parallel.
	fullyParallel: true,

	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: isCI,

	// Repeat each test
	repeatEach: 1,

	// Retry on CI only.
	retries: isCI ? 2 : 0,

	timeout: 60_000,

	// Opt out of parallel tests on dev server.
	workers: isDev ? 1 : Number(process.env.PLAYWRIGHT_WORKERS) || 4,

	// Reporter to use
	reporter: "list",

	use: {
		trace: "retain-on-first-failure",
		actionTimeout: isCI ? 15_000 : 1200,
		navigationTimeout: isCI ? 15_000 : 30_000,
	},

	// Configure projects for major browsers.
	projects: [
		{
			name: "web",
			testDir: "./platforms/web/tests",
			// The stash suite lives under this testDir but is its own project — it pushes to real
			// repositories for every case and is far too slow to sit in the MR pipeline.
			testIgnore: "**/features/git/stash/**",
			use: {
				...devices["Desktop Chrome"],
				bypassCSP: true,
				baseURL: webBaseURL,
				screenshot: "on-first-failure",
				ignoreHTTPSErrors: true,
				launchOptions: {
					args: [
						"--disable-web-security",
						"--disable-features=IsolateOrigins,site-per-process,CertVerifierBuiltinFeatureUsage",
						"--ignore-certificate-errors",
						"--ignore-certificate-errors-spki-list",
						"--allow-insecure-localhost",
						"--disable-dev-shm-usage",
						"--no-sandbox",
						"--disable-setuid-sandbox",
					],
				},
			},
		},
		{
			name: "web-enterprise",
			testDir: "./platforms/web/enterprise/tests",
			use: {
				...devices["Desktop Chrome"],
				bypassCSP: true,
				baseURL: webBaseURL,
				screenshot: "on-first-failure",
				ignoreHTTPSErrors: true,
				launchOptions: {
					args: [
						"--disable-web-security",
						"--disable-features=IsolateOrigins,site-per-process,CertVerifierBuiltinFeatureUsage",
						"--ignore-certificate-errors",
						"--ignore-certificate-errors-spki-list",
						"--allow-insecure-localhost",
						"--disable-dev-shm-usage",
						"--no-sandbox",
						"--disable-setuid-sandbox",
					],
				},
			},
		},

		{
			// What a stash must not lose, and what the commands around it may cost. Every case drives a
			// real repository through checkout, pull and conflict resolution, which is slow — but what it
			// protects is a user's unpublished work and a regression nobody would notice until it shipped,
			// so it gates a merge request rather than waiting for someone to ask.
			name: "web-stash",
			testDir: "./platforms/web/tests/features/git/stash",
			// The measuring cases are their own project: they are read for their numbers, and numbers
			// that fail a pipeline teach people to rerun it rather than to read them.
			testIgnore: MEASUREMENT_SPECS,
			timeout: 180_000,
			use: {
				...devices["Desktop Chrome"],
				bypassCSP: true,
				baseURL: webBaseURL,
				screenshot: "on-first-failure",
				// Same budget locally and in CI, unlike the shared default (1200ms against 15000ms).
				// Every case here waits on a real repository, and a threshold that only bites on a
				// developer's machine makes a local run say nothing about the scheduled one — the run
				// this suite exists for. The gating suites keep the tighter local default.
				actionTimeout: 15_000,
				ignoreHTTPSErrors: true,
				launchOptions: {
					args: [
						"--disable-web-security",
						"--disable-features=IsolateOrigins,site-per-process,CertVerifierBuiltinFeatureUsage",
						"--ignore-certificate-errors",
						"--ignore-certificate-errors-spki-list",
						"--allow-insecure-localhost",
						"--disable-dev-shm-usage",
						"--no-sandbox",
						"--disable-setuid-sandbox",
					],
				},
			},
		},
		{
			// The same suite, run for its numbers: it drives the measured commands on a catalog the size
			// of a customer's and reports what they cost. Started by hand, against the change under
			// review, because that is when the numbers mean anything.
			name: "web-stash-timings",
			testDir: "./platforms/web/tests/features/git/stash",
			testMatch: MEASUREMENT_SPECS,
			timeout: 180_000,
			use: {
				...devices["Desktop Chrome"],
				bypassCSP: true,
				baseURL: webBaseURL,
				screenshot: "on-first-failure",
				// Same budget locally and in CI, unlike the shared default (1200ms against 15000ms).
				// Every case here waits on a real repository, and a threshold that only bites on a
				// developer's machine makes a local run say nothing about the scheduled one — the run
				// this suite exists for. The gating suites keep the tighter local default.
				actionTimeout: 15_000,
				ignoreHTTPSErrors: true,
				launchOptions: {
					args: [
						"--disable-web-security",
						"--disable-features=IsolateOrigins,site-per-process,CertVerifierBuiltinFeatureUsage",
						"--ignore-certificate-errors",
						"--ignore-certificate-errors-spki-list",
						"--allow-insecure-localhost",
						"--disable-dev-shm-usage",
						"--no-sandbox",
						"--disable-setuid-sandbox",
					],
				},
			},
		},

		{
			name: "static",
			testDir: "./platforms/static/tests",
			use: {
				...devices["Desktop Chrome"],
				bypassCSP: true,
				baseURL: "http://localhost:6002",
				screenshot: "on-first-failure",
				launchOptions: {
					args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
		{
			name: "next-prepare",
			testDir: "./platforms/docportal/prepare",
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://localhost:6003",
				bypassCSP: true,
				screenshot: "on-first-failure",
			},
		},
		{
			name: "next",
			testDir: "./platforms/docportal/tests",
			dependencies: ["next-prepare"],
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://localhost:6003",
				bypassCSP: true,
				screenshot: "on-first-failure",
				launchOptions: {
					args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
		{
			name: "next-enterprise",
			testDir: "./platforms/docportal/tests/enterprise",
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://localhost:6003",
				bypassCSP: true,
				screenshot: "on-first-failure",
				launchOptions: {
					args: ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
		{
			name: "docportal-prepare",
			testDir: "./platforms/docportal/prepare",
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://127.0.0.1:6004",
				bypassCSP: true,
				screenshot: "on-first-failure",
			},
		},
		{
			name: "docportal",
			testDir: "./platforms/docportal/tests",
			dependencies: ["docportal-prepare"],
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://127.0.0.1:6004",
				bypassCSP: true,
				screenshot: "on-first-failure",
				launchOptions: {
					args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
	],

	webServer: isDev
		? {
				command: `PORT=${webPort} bun run --cwd ../apps/web dev`,
				port: webPort,
				reuseExistingServer: true,
				ignoreHTTPSErrors: true,
			}
		: undefined,
});
