import tccCategory from "@ext/workspace/error/tccCategory";

/**
 * macOS does not gate a path — it gates a category. Privacy & Security → Files and Folders shows
 * Gramax a row per category ("Documents Folder", "Desktop Folder", …), so telling the user to
 * "allow access to this directory" leaves them hunting: the toggle is named after the category
 * their path happens to sit in, and nothing on screen says which one that is.
 */
describe("tccCategory", () => {
	test("узнаёт Документы", () => {
		expect(tccCategory("/Users/pavel.smirnov/Documents/Gramax/default")).toBe("documents");
	});

	test("узнаёт Рабочий стол и Загрузки", () => {
		expect(tccCategory("/Users/pavel.smirnov/Desktop/notes")).toBe("desktop");
		expect(tccCategory("/Users/pavel.smirnov/Downloads/notes")).toBe("downloads");
	});

	test("узнаёт iCloud Drive", () => {
		expect(tccCategory("/Users/pavel.smirnov/Library/Mobile Documents/com~apple~CloudDocs/notes")).toBe("icloud");
	});

	test("узнаёт домашнюю директорию за firmlink", () => {
		// What `realpath` gives back on APFS — the same protected folder, spelled the long way.
		expect(tccCategory("/System/Volumes/Data/Users/pavel.smirnov/Documents/notes")).toBe("documents");
	});

	test("сама категория, без вложенности, тоже считается", () => {
		expect(tccCategory("/Users/pavel.smirnov/Documents")).toBe("documents");
	});

	test("не гадает про остальные пути", () => {
		// A directory outside every protected category is not a TCC problem — naming a category
		// there would send the user to a toggle that has nothing to do with their folder.
		expect(tccCategory("/Users/pavel.smirnov/Projects/notes")).toBeNull();
		expect(tccCategory("/opt/gramax")).toBeNull();
		expect(tccCategory("")).toBeNull();
		expect(tccCategory(undefined)).toBeNull();
	});

	test("не называет категорию для томов", () => {
		// `/Volumes` holds removable drives, network shares, and plain extra internal volumes —
		// three different answers in Privacy & Security, and the path alone does not say which.
		// Sending someone to the wrong toggle is worse than sending them nowhere.
		expect(tccCategory("/Volumes/SSD/notes")).toBeNull();
		expect(tccCategory("/Volumes/NetShare/docs")).toBeNull();
		expect(tccCategory("/Volumes/Macintosh HD/Users/me/Projects/x")).toBeNull();
	});

	test("не считает /Users/Shared домашней директорией", () => {
		// `/Users/Shared/Documents` is not the TCC-gated Documents folder of anybody.
		expect(tccCategory("/Users/Shared/Documents/team")).toBeNull();
	});

	test("не доверяет относительным путям и `..`", () => {
		// Both used to slip through: `filter(Boolean)` erased the leading slash, and a `..`
		// segment just sat in the array while the prefix still matched.
		expect(tccCategory("Users/me/Documents/notes")).toBeNull();
		expect(tccCategory("/Users/me/Documents/../Projects/notes")).toBeNull();
	});

	test("не путает папку с похожим именем", () => {
		// `~/Documents2` is not `~/Documents`, and `~/Projects/Documents` is not protected either.
		expect(tccCategory("/Users/pavel.smirnov/Documents2/notes")).toBeNull();
		expect(tccCategory("/Users/pavel.smirnov/Projects/Documents/notes")).toBeNull();
	});
});
