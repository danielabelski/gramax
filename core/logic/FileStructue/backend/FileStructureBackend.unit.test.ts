import MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { ArticleNodeDto, CategoryNodeDto, NodeDto } from "@core/FileStructue/backend/FileStructureBackend";
import { BACKENDS, type BackendKind, makeBackend } from "@core/FileStructue/backend/testBackends";
import { resolve } from "path";

const path = (p: string) => new Path(p);

const relPaths = (nodes: NodeDto[]) => nodes.map((n) => n.relPath);
const categoryNamed = (nodes: NodeDto[], directory: string) =>
	nodes.find((n): n is CategoryNodeDto => n.kind === "category" && n.directory === directory);

/**
 * The DTO contract both backends answer to. Hydration, healing and serialization sit above this
 * layer and are covered by `FileStructure.unit.test.ts`; what is pinned here is the shape the two
 * implementations must agree on — ordering, relative paths, what counts as a section, and how
 * frontmatter survives the trip.
 */
describe.each(BACKENDS)("%s backend", (kind: BackendKind) => {
	const fp = MountFileProvider.fromDefault(new Path(resolve(__dirname, `backend-fixtures-${kind}`)));
	const backend = makeBackend(kind, fp, [resolve(__dirname, `backend-fixtures-${kind}`, "known-ws", "inner")]);

	beforeAll(async () => {
		await fp.write(path("cat/doc-root.yaml"), "title: Cat\nlanguage: ru\n");
		await fp.write(path("cat/b.md"), "---\norder: 2\ntitle: B\n---\nbody");
		await fp.write(path("cat/a.md"), "---\ntitle: A\n---\nbody");
		await fp.write(path("cat/_1.md"), "");
		await fp.write(path("cat/notes.txt"), "not an article");
		await fp.write(path("cat/section/_index.md"), "---\ntitle: Section\n---\n");
		await fp.write(path("cat/section/inner.md"), "");
		await fp.write(path("cat/indexless/deep.md"), "");
		await fp.write(path("cat/.gramax/hidden.md"), "");
		// A Windows editor writes a BOM ahead of the frontmatter fence; the props are still props.
		await fp.write(path("cat/bom.md"), "\uFEFF---\ntitle: Bommed\norder: 2\n---\nbody");
		await fp.mkdir(path("cat/empty"));

		await fp.write(path("bomroot/doc-root.yaml"), "\uFEFFtitle: Bom Root\n");
		await fp.write(path("bomroot/a.md"), "");

		await fp.write(path("nested/sub/doc-root.yaml"), "title: Nested\n");
		await fp.write(path("nested/sub/a.md"), "");

		await fp.write(path("broken/doc-root.yaml"), "");
		await fp.write(path("broken/unterminated.md"), "---\ntitle: never closed\n");
		await fp.write(path("broken/malformed.md"), "---\nkey: [unclosed\n---\nbody");
		await fp.write(path("broken/plain.md"), "no frontmatter at all\n");
		// Valid YAML, but a sequence is not props.
		await fp.write(path("broken/sequence.md"), "---\n- a\n- b\n---\nbody");

		// A doc-root is an exact name, not a pattern: `my-root.yaml` is a plain file.
		await fp.write(path("loose/my-root.yaml"), "title: Not a docroot\n");
		await fp.write(path("loose/a.md"), "");

		// Hidden directories are never descended into, so this doc-root stays invisible.
		await fp.write(path("hidden-docroot/.config/doc-root.yaml"), "title: Hidden\n");
		await fp.write(path("hidden-docroot/a.md"), "");

		await fp.write(path("has-ws/workspace.yaml"), "");
		await fp.write(path("known-ws/inner/doc-root.yaml"), "");
		await fp.write(path(".hidden-dir/doc-root.yaml"), "");
	});

	afterAll(async () => {
		await fp.delete(Path.empty);
	});

	describe("scanWorkspace", () => {
		test("reports catalog directories in name order", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.map((e) => e.relPath)).toEqual([
				"bomroot",
				"broken",
				"cat",
				"hidden-docroot",
				"loose",
				"nested",
			]);
		});

		test("reports the doc-root relative to the catalog directory", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.find((e) => e.relPath === "cat").docrootRel).toBe("doc-root.yaml");
			expect(entries.find((e) => e.relPath === "nested").docrootRel).toBe("sub/doc-root.yaml");
		});

		test("reads doc-root props behind a byte order mark", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.find((e) => e.relPath === "bomroot").catalogProps).toMatchObject({ title: "Bom Root" });
		});

		test("reads the doc-root props", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.find((e) => e.relPath === "cat").catalogProps).toMatchObject({
				title: "Cat",
				language: "ru",
			});
		});

		test("does not accept a name that merely looks like a doc-root", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.find((e) => e.relPath === "loose").docrootRel).toBeNull();
		});

		test("does not look for a doc-root inside a hidden directory", async () => {
			const entries = await backend.scanWorkspace();
			expect(entries.find((e) => e.relPath === "hidden-docroot").docrootRel).toBeNull();
		});

		test("skips hidden dirs, nested workspaces and registered workspace paths", async () => {
			const entries = await backend.scanWorkspace();
			const names = entries.map((e) => e.relPath);
			expect(names).not.toContain(".hidden-dir");
			expect(names).not.toContain("has-ws");
			expect(names).not.toContain("known-ws");
		});
	});

	describe("scanCatalog", () => {
		test("lists articles before categories, each in name order", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			expect(relPaths(tree.children)).toEqual([
				"_1.md",
				"a.md",
				"b.md",
				"bom.md",
				"indexless",
				"section/_index.md",
			]);
		});

		test("drops a directory with neither an index nor anything below it", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			expect(categoryNamed(tree.children, "empty")).toBeUndefined();
		});

		test("keeps non-markdown files and excluded dirs out of the tree", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			expect(relPaths(tree.children)).not.toContain("notes.txt");
			expect(relPaths(tree.children)).not.toContain(".gramax");
		});

		test("marks a directory without an index as a section without one", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			const indexless = categoryNamed(tree.children, "indexless");
			expect(indexless.hasIndex).toBe(false);
			expect(indexless.relPath).toBe("indexless");
			expect(relPaths(indexless.children)).toEqual(["indexless/deep.md"]);
		});

		test("points a section with an index at its index file", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			const section = categoryNamed(tree.children, "section");
			expect(section.hasIndex).toBe(true);
			expect(section.relPath).toBe("section/_index.md");
			expect(section.frontMatter).toMatchObject({ title: "Section" });
			expect(relPaths(section.children)).toEqual(["section/inner.md"]);
		});

		test("starts the tree next to a doc-root nested in a subdirectory", async () => {
			const tree = await backend.scanCatalog(path("nested"));
			expect(tree.docrootRel).toBe("sub/doc-root.yaml");
			expect(relPaths(tree.children)).toEqual(["sub/a.md"]);
		});

		test("takes the doc-root it is given instead of searching", async () => {
			const tree = await backend.scanCatalog(path("cat"), { docrootRel: "doc-root.yaml" });
			expect(tree.docrootRel).toBe("doc-root.yaml");
			expect(relPaths(tree.children)).toContain("a.md");
		});

		// gram-ax/gramax#879 — the frontend writes props back in the order it received them.
		test("hands frontmatter keys over in file order", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			const b = tree.children.find((n) => n.relPath === "b.md");
			expect(Object.keys(b.frontMatter)).toEqual(["order", "title"]);
		});

		// A missed BOM parses as empty props, and the next save writes that loss back to the file.
		test("reads frontmatter behind a byte order mark", async () => {
			const tree = await backend.scanCatalog(path("cat"));
			const bom = tree.children.find((n) => n.relPath === "bom.md");
			expect(bom.frontMatter).toMatchObject({ title: "Bommed", order: 2 });
			expect((bom as ArticleNodeDto).parseError).toBeNull();
		});

		test("refuses frontmatter that is valid YAML but not a mapping", async () => {
			const tree = await backend.scanCatalog(path("broken"));
			const seq = tree.children.find((n) => n.relPath === "sequence.md");
			// An array here would serialize back into the file as keys `0`, `1`, …
			expect(Array.isArray(seq.frontMatter)).toBe(false);
			expect(seq.frontMatter).toEqual({});
			// Nothing failed to parse, so neither backend reports an error — `parseError` drives a
			// telemetry event, and one backend inventing one is a divergence the suite must catch.
			expect((seq as ArticleNodeDto).parseError).toBeNull();
		});

		test("reports empty and unparsable frontmatter without props", async () => {
			const tree = await backend.scanCatalog(path("broken"));
			const articles = tree.children.filter((n): n is ArticleNodeDto => n.kind === "article");
			const byName = Object.fromEntries(articles.map((n) => [n.relPath, n]));

			expect(byName["plain.md"].frontMatter).toEqual({});
			expect(byName["plain.md"].parseError).toBeNull();

			// The two backends word their errors differently; what must match is that neither hands
			// back a half-parsed props bag.
			expect(byName["unterminated.md"].frontMatter).toEqual({});
			expect(byName["unterminated.md"].parseError).toBeTruthy();

			expect(byName["malformed.md"].frontMatter).toEqual({});
			expect(byName["malformed.md"].parseError).toBeTruthy();
		});
	});

	describe("scanDirectory", () => {
		test("returns the subtree with paths relative to that directory", async () => {
			const children = await backend.scanDirectory(path("cat/section"));
			expect(relPaths(children)).toEqual(["inner.md"]);
		});

		test("does not shift the root onto a doc-root found elsewhere", async () => {
			const children = await backend.scanDirectory(path("nested"));
			expect(relPaths(children)).toEqual(["sub"]);
		});
	});
});
