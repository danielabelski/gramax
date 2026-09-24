export const desktopHandoffScript = (env: NodeJS.ProcessEnv, read: (path: string) => string) =>
	env.PRODUCTION === "true" ? `<script>${read("scripts/web/tryOpenInDesktop.js")}</script>` : "";
