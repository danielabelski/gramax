export const breakpoints = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export const breakpointOrder = Object.keys(breakpoints) as Breakpoint[];

export const tailwindScreens = Object.fromEntries(
	Object.entries(breakpoints).map(([name, width]) => [name, `${width}px`]),
) as Record<Breakpoint, string>;
