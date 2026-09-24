import { env } from "./utils";

/** Branch every temp repo is created with; Gramax test catalogs live on `master`. */
const DEFAULT_BRANCH = "master";
const PER_PAGE = 100;

export type TempRepo = {
	id: number;
	name: string;
	group: string;
	httpUrl: string;
};

export type GitlabGroup = { id: number; full_path: string };

export type GitlabProject = {
	id: number;
	name: string;
	path_with_namespace: string;
};

const host = () => env("GX_E2E_GIT_HOST");
const token = () => env("GX_E2E_GIT_TOKEN");

const api = async (path: string, init?: RequestInit): Promise<Response> => {
	const method = init?.method ?? "GET";
	const res = await fetch(`https://${host()}/api/v4/${path}`, {
		...init,
		headers: {
			"PRIVATE-TOKEN": token(),
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});

	if (!res.ok) throw new Error(`GitLab ${method} /${path} failed: ${res.status} ${await res.text()}`);
	return res;
};

export const getGroup = async (groupPath: string): Promise<GitlabGroup> => {
	const res = await api(`groups/${encodeURIComponent(groupPath)}`);
	return (await res.json()) as GitlabGroup;
};

export type TokenIdentity = { username: string; bot: boolean; state: string };

/** Who GitLab thinks the token is. Throws when the token is revoked, expired or not a token. */
export const getTokenIdentity = async (): Promise<TokenIdentity> => {
	const res = await api("user");
	const user = (await res.json()) as { username: string; bot?: boolean; state: string };
	return { bot: Boolean(user.bot), state: user.state, username: user.username };
};

export const createProject = async (name: string): Promise<TempRepo> => {
	const group = env("GX_E2E_GIT_TEMP_GROUP");
	const { id: namespaceId } = await getGroup(group);

	const res = await api("projects", {
		body: JSON.stringify({
			default_branch: DEFAULT_BRANCH,
			name,
			namespace_id: namespaceId,
			path: name,
			visibility: "private",
		}),
		method: "POST",
	});

	const project = (await res.json()) as {
		id: number;
		path: string;
		http_url_to_repo: string;
	};
	return {
		group,
		httpUrl: project.http_url_to_repo,
		id: project.id,
		name: project.path,
	};
};

/**
 * One action of a commit made straight against GitLab, without going through Gramax.
 *
 * This is how a test produces incoming changes: the catalog under test is a working copy, and a
 * change it is supposed to pull has to appear on the remote while the app is not looking.
 */
export type RemoteAction = {
	action: "create" | "update" | "delete" | "move";
	filePath: string;
	content?: string;
	previousPath?: string;
};

/** Writes one commit out of arbitrary actions. */
export const commitToRemote = async (
	id: number,
	actions: RemoteAction[],
	message: string,
	branch: string = DEFAULT_BRANCH,
): Promise<void> => {
	if (!actions.length) return;

	await api(`projects/${id}/repository/commits`, {
		body: JSON.stringify({
			actions: actions.map(({ action, filePath, content, previousPath }) => ({
				action,
				content,
				file_path: filePath,
				previous_path: previousPath,
			})),
			branch,
			commit_message: message,
		}),
		method: "POST",
	});
};

/** Writes the whole tree as one commit; the repo must be empty (the branch is created by this call). */
export const commitFiles = async (id: number, files: Record<string, string>, message: string): Promise<void> => {
	const actions = Object.entries(files).map<RemoteAction>(([filePath, content]) => ({
		action: "create",
		content,
		filePath,
	}));

	await commitToRemote(id, actions, message);
};

/**
 * Actions per seeding commit.
 *
 * The commits API takes the whole tree as one JSON body, and a body carrying thousands of articles is
 * refused outright (413 / `500` behind the proxy) or times out halfway through — either way the seed
 * is lost with nothing to retry. A few hundred actions is a payload of a few hundred kilobytes, which
 * is an ordinary request, so seeding a large catalog stays a normal series of commits.
 */
const SEED_CHUNK = 200;

/** Roughly a hundred articles per folder, so the tree has depth instead of one flat directory. */
const SEED_FOLDER_SIZE = 100;

/**
 * One seeded article: real frontmatter and two paragraphs, so the file weighs like an article rather
 * than like a stub — file size is part of what a working-copy walk pays for.
 */
const seedArticle = (n: number): string => `---
title: Article ${n}
---

Seeded article ${n} of a large e2e catalog. It carries real text so the file weighs what an article weighs: a walk over the working copy pays per byte as well as per entry.

The wording is fixed on purpose — two runs of the same size seed a byte-for-byte identical tree, so the only thing that differs between them is what is being measured.
`;

/**
 * Fills a fresh project with `count` generated articles, in commits of at most `SEED_CHUNK` actions.
 *
 * Articles land in `docs/part-<k>/a-<i>.md` — a real catalog is not one flat directory, and walking
 * the directories is part of what the stash measurements are about. `.doc-root.yaml` is always
 * written, so the repository is a valid Gramax catalog; `extra` is merged in as literal
 * path→content afterwards and may therefore override it (a per-catalog title, a `.gitignore`).
 */
export const seedLargeCatalog = async (id: number, count: number, extra?: Record<string, string>): Promise<void> => {
	const files: Record<string, string> = { ".doc-root.yaml": "title: E2E Large Catalog\n" };

	for (let i = 1; i <= count; i++) files[`docs/part-${Math.ceil(i / SEED_FOLDER_SIZE)}/a-${i}.md`] = seedArticle(i);

	const actions = Object.entries({ ...files, ...extra }).map<RemoteAction>(([filePath, content]) => ({
		action: "create",
		content,
		filePath,
	}));

	for (let from = 0; from < actions.length; from += SEED_CHUNK) {
		const chunk = actions.slice(from, from + SEED_CHUNK);
		await commitToRemote(id, chunk, `e2e: seed articles ${from + 1}-${from + chunk.length}`);
	}
};

/** Reads a file as the remote has it — the only way to check what a push actually left there. */
export const readRemoteFile = async (id: number, filePath: string, ref: string = DEFAULT_BRANCH): Promise<string> => {
	const res = await api(`projects/${id}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`);
	return await res.text();
};

/**
 * How many files the remote holds, walking the whole tree.
 *
 * A measurement is only readable next to the size it was taken at, and for a repository the run did
 * not seed that size is not known up front — the generated size knob would report a number that has
 * nothing to do with the catalog being measured.
 */
export const countRemoteFiles = async (id: number, ref: string = DEFAULT_BRANCH): Promise<number> => {
	let count = 0;
	let page = 1;

	while (true) {
		const res = await api(
			`projects/${id}/repository/tree?recursive=true&per_page=${PER_PAGE}&page=${page}&ref=${encodeURIComponent(ref)}`,
		);
		const entries = (await res.json()) as { type: string }[];
		if (!entries.length) return count;

		count += entries.filter((entry) => entry.type === "blob").length;
		page++;
	}
};

/**
 * Whether the remote already holds a path.
 *
 * The commits API has no upsert: `create` on an existing file is a 400, `update` on a missing one is
 * a 404. A repository that outlives the run needs the answer before it can pick an action.
 */
export const remoteFileExists = async (
	id: number,
	filePath: string,
	ref: string = DEFAULT_BRANCH,
): Promise<boolean> => {
	// Straight `fetch`, not `api`: a missing file is the answer this asks for, and `api` turns any
	// non-2xx into a throw.
	const res = await fetch(
		`https://${host()}/api/v4/projects/${id}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
		{ headers: { "PRIVATE-TOKEN": token() } },
	);

	return res.ok;
};

export const createRemoteBranch = async (id: number, name: string, ref: string = DEFAULT_BRANCH): Promise<void> => {
	await api(`projects/${id}/repository/branches?branch=${encodeURIComponent(name)}&ref=${encodeURIComponent(ref)}`, {
		method: "POST",
	});
};

export const deleteRemoteBranch = async (id: number, name: string): Promise<void> => {
	await api(`projects/${id}/repository/branches/${encodeURIComponent(name)}`, { method: "DELETE" });
};

/**
 * Finds a project by `<group>/<name>`.
 *
 * Catalogs linked through Gramax are created by the push itself, so the test never sees an id come
 * back — it has to ask for one before it can commit to that repository behind the app's back.
 */
export const getProject = async (pathWithNamespace: string): Promise<GitlabProject> => {
	const res = await api(`projects/${encodeURIComponent(pathWithNamespace)}`);
	return (await res.json()) as GitlabProject;
};

/**
 * Copies a fixture repository into the temp group, so a run can write to it freely.
 *
 * A measurement needs the same catalog every time — same files, same history, same size — and it
 * publishes, syncs and branches while it runs. Both are only possible if the thing measured is a
 * copy: the fixture stays as it was, and the copy is thrown away with the rest of the run.
 *
 * Forking is server-side, which is the point: cloning three and a half thousand files up and back
 * would cost more than the measurement.
 */
export const forkProject = async (fixturePath: string, name: string): Promise<TempRepo> => {
	const group = env("GX_E2E_GIT_TEMP_GROUP");
	const { id: namespaceId } = await getGroup(group);

	const res = await api(`projects/${encodeURIComponent(fixturePath)}/fork`, {
		body: JSON.stringify({ name, namespace_id: namespaceId, path: name }),
		method: "POST",
	});

	const project = (await res.json()) as { id: number; path: string; http_url_to_repo: string };

	await waitForImport(project.id);
	// A fork keeps the fixture as its parent, and deleting the fixture would then ask about its forks.
	// Nothing here needs the relation, and a run that dies before teardown should not leave one.
	await api(`projects/${project.id}/fork`, { method: "DELETE" }).catch(() => undefined);

	return { group, httpUrl: project.http_url_to_repo, id: project.id, name: project.path };
};

/** A fork is copied in the background; until it finishes the repository answers as if it were empty. */
const waitForImport = async (id: number, timeoutMs = 120_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const res = await api(`projects/${id}?statistics=false`);
		const { import_status: status } = (await res.json()) as { import_status?: string };

		if (status === "finished" || status === "none") return;
		if (status === "failed") throw new Error(`fork of project ${id} failed to import`);
		if (Date.now() > deadline) throw new Error(`fork of project ${id} still ${status} after ${timeoutMs} ms`);

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
};

export const deleteProject = async (id: number): Promise<void> => {
	await api(`projects/${id}?permanently_delete=true`, { method: "DELETE" });
};

export const listGroupProjects = async (groupPath: string): Promise<GitlabProject[]> => {
	const projects: GitlabProject[] = [];
	const group = encodeURIComponent(groupPath);

	for (let page = 1; ; page++) {
		const res = await api(`groups/${group}/projects?include_subgroups=true&per_page=${PER_PAGE}&page=${page}`);
		const batch = (await res.json()) as GitlabProject[];

		projects.push(...batch);
		if (batch.length < PER_PAGE) break;
	}

	return projects;
};

const localUser = () => process.env.USER || process.env.USERNAME || "unknown";

let cachedRunId: string | null = null;

/**
 * Identifies one test run. In CI it is the pipeline id; locally it is derived from the user and the
 * start time, so a local run never picks up someone else's repos when cleaning up.
 */
export const runId = (): string => {
	if (!cachedRunId)
		cachedRunId = env.optional("GX_E2E_RUN_ID") ?? `local-${localUser()}-${Math.floor(Date.now() / 1000)}`;
	return cachedRunId;
};

/**
 * Prefix shared by every repo of a run — the teardown deletes by it. In CI it pins the pipeline;
 * locally it widens to the user, so leftovers of earlier local runs are collected too.
 */
export const tempRepoPrefix = (): string => {
	const ciRunId = env.optional("GX_E2E_RUN_ID");
	return ciRunId ? `e2e-${ciRunId}-` : `e2e-local-${localUser()}-`;
};

let counter = 0;

export const nextTempRepoName = (workerIndex: number): string => `e2e-${runId()}-w${workerIndex}-${++counter}`;
