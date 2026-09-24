/**
 * Privacy & Security → Files and Folders, where Gramax gets a row with a toggle per protected
 * category (Desktop, Documents, Downloads, removable and network volumes). Not Full Disk Access:
 * that grants far more than opening one folder needs.
 *
 * Caveat worth knowing when writing the surrounding copy: the row only appears once the app has
 * actually asked the system for that category at least once. A user who has never hit the OS
 * prompt will find the list empty.
 *
 * macOS only — TCC has no counterpart on Windows or Linux, so there is no pane to send anyone to
 * and `null` tells the caller to hide the button.
 */
const systemSettingsUrl = (userAgent: string | undefined): string | null =>
	userAgent?.includes("Mac") ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Files" : null;

export default systemSettingsUrl;
