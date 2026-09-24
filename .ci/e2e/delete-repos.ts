#!/usr/bin/env bun

/**
 * Empties the e2e temp group of every project it holds. Meant for the scheduled `e2e-temp-cleanup`
 * job — the Playwright teardown already removes what a normal run creates, this collects the rest.
 *
 * The group is the only safety boundary, so it is checked twice: the resolved group must be exactly
 * GX_E2E_GIT_TEMP_GROUP, and every project must sit under it.
 */

import assert from "node:assert";
import { deleteProject, getGroup, listGroupProjects } from "../../e2e-pw/utils/gitlab.ts";

const tempGroup = process.env.GX_E2E_GIT_TEMP_GROUP;

assert(process.env.GX_E2E_GIT_HOST, "GX_E2E_GIT_HOST was not provided");
assert(process.env.GX_E2E_GIT_TOKEN, "GX_E2E_GIT_TOKEN was not provided");
assert(tempGroup, "GX_E2E_GIT_TEMP_GROUP was not provided");

const group = await getGroup(tempGroup);
assert(group.full_path === tempGroup, `refusing to clean up: "${tempGroup}" resolved to group "${group.full_path}"`);

const prefix = `${tempGroup}/`;
const projects = await listGroupProjects(tempGroup);

// Age is deliberately not a criterion: the schedule is meant to leave the group empty, even if a
// pipeline is running at the time. The name is, so that anything put here by hand survives.
const targets = projects.filter((p) => {
	if (!p.path_with_namespace.startsWith(prefix)) {
		console.warn(`  skipped: ${p.path_with_namespace} (outside ${prefix})`);
		return false;
	}
	if (!p.name.startsWith("e2e-")) {
		console.warn(`  skipped: ${p.path_with_namespace} (not an e2e temp repo)`);
		return false;
	}
	return true;
});

if (!targets.length) {
	console.log(`No projects in ${tempGroup}.`);
	process.exit(0);
}

console.log(`Found ${targets.length} project(s) in ${tempGroup}:`);
for (const p of targets) console.log(`  - ${p.path_with_namespace} (id=${p.id})`);

if (process.argv.includes("--dry-run")) {
	console.log("\nDry run - no deletions performed.");
	process.exit(0);
}

console.log("\nDeleting...");

let failed = 0;
for (const p of targets) {
	await new Promise((resolve) => setTimeout(resolve, 200));
	try {
		await deleteProject(p.id);
		console.log(`  deleted: ${p.path_with_namespace} (id=${p.id})`);
	} catch (e) {
		failed++;
		console.error(`  FAILED: ${p.path_with_namespace} (id=${p.id}) - ${String(e)}`);
	}
}

console.log("Done.");
process.exit(failed ? 1 : 0);
