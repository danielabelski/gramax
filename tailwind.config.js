// tailwind.config.js
// biome-ignore lint/style/noRestrictedImports: expected
import icsPreset from "ics-ui-kit/tailwind.preset";
import { dirname, resolve } from "path";
import plugin from "tailwindcss/plugin";
import { fileURLToPath } from "url";
import { tailwindScreens } from "./core/ui-logic/constants/breakpoints";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
	presets: [icsPreset],
	content: [
		resolve(root, "core/**/*.{ts,tsx}"),
		resolve(root, "app/**/*.{ts,tsx}"),
		resolve(root, "apps/**/*.{ts,tsx}"),
		resolve(root, "node_modules/ics-ui-kit/dist/**/*.js"),
	],
	theme: {
		screens: tailwindScreens,
		extend: {
			colors: {
				status: {
					purple: {
						DEFAULT: "hsl(var(--status-purple))",
						"primary-bg": "hsl(var(--status-purple-primary-bg))",
					},
				},
			},
			boxShadow: {
				"glass-xl": "var(--shadow-glass-xl)",
			},
			animation: {
				"sync-progress": "sync-progress 1s linear infinite",
				"wifi-pulse": "wifi-pulse 1.5s cubic-bezier(.65,.815,.735,.395) infinite",
			},
			keyframes: {
				"sync-progress": {
					to: { strokeDashoffset: "-10" },
				},
				"wifi-pulse": {
					"0%": { opacity: "0.5" },
					"33%": { opacity: "0.5" },
					"66%": { opacity: "1" },
					"100%": { opacity: "0.5" },
				},
			},
		},
	},
	plugins: [
		plugin(({ addUtilities }) => {
			addUtilities({
				".backdrop-glass-clear": { backdropFilter: "var(--glass-clear)" },
				".backdrop-glass-thin": { backdropFilter: "var(--glass-thin)" },
				".backdrop-glass-regular": { backdropFilter: "var(--glass-regular)" },
				".backdrop-glass-thick": { backdropFilter: "var(--glass-thick)" },
			});
		}),
	],
};
