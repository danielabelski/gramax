import systemSettingsUrl from "@ext/workspace/error/systemSettingsUrl";

/**
 * Once macOS has been told "Don't Allow" the system prompt never comes back, so the only way out
 * from inside the app is a deep link into the right pane of System Settings. The URL is the
 * contract with the OS — a typo lands the user on a generic Privacy page with no idea what to
 * flip, so it is worth pinning rather than eyeballing.
 */
const MACOS =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

describe("systemSettingsUrl", () => {
	test("на macOS ведёт в Privacy & Security → Files and Folders", () => {
		expect(systemSettingsUrl(MACOS)).toBe("x-apple.systempreferences:com.apple.preference.security?Privacy_Files");
	});

	test("на остальных ОС ссылки нет — кнопку показывать нечему", () => {
		// TCC is a macOS thing. Windows and Linux deny access too, but there is no pane to send
		// anyone to, so the caller must get `null` and hide the button rather than open garbage.
		expect(systemSettingsUrl(WINDOWS)).toBeNull();
		expect(systemSettingsUrl(LINUX)).toBeNull();
	});

	test("без user agent не гадаем", () => {
		// Server-side render, or a webview that reports nothing — better no button than a button
		// that opens something meaningless.
		expect(systemSettingsUrl(undefined)).toBeNull();
	});
});
