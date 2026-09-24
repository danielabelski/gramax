import { deleteProject, listGroupProjects, tempRepoPrefix } from "@utils/gitlab";

/**
 * Sweeps the temp group for repos this run created. Worker fixtures delete their own projects, so
 * this only picks up what a crashed worker or a push-to-create scenario left behind.
 */
const globalTeardown = async () => {
	const group = process.env.GX_E2E_GIT_TEMP_GROUP;
	if (!group || !process.env.GX_E2E_GIT_TOKEN || !process.env.GX_E2E_GIT_HOST) return;

	const prefix = tempRepoPrefix();

	let projects: Awaited<ReturnType<typeof listGroupProjects>>;
	try {
		projects = await listGroupProjects(group);
	} catch (e) {
		console.warn(`temp repo teardown: cannot list ${group}: ${String(e)}`);
		return;
	}

	const targets = projects.filter((p) => p.path_with_namespace.startsWith(`${group}/`) && p.name.startsWith(prefix));

	for (const project of targets) {
		try {
			await deleteProject(project.id);
			console.log(`temp repo teardown: deleted ${project.path_with_namespace}`);
		} catch (e) {
			console.warn(`temp repo teardown: cannot delete ${project.path_with_namespace}: ${String(e)}`);
		}
	}
};

export default globalTeardown;
