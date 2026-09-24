import { type Breakpoint, breakpointOrder, breakpoints } from "@core-ui/constants/breakpoints";
import { useSyncExternalStore } from "react";

const SERVER_BREAKPOINT: Breakpoint = "lg";
const listeners = new Set<() => void>();

const notifyListeners = () => {
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);

	if (listeners.size === 1 && typeof window !== "undefined") {
		window.addEventListener("resize", notifyListeners);
	}

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && typeof window !== "undefined") {
			window.removeEventListener("resize", notifyListeners);
		}
	};
};

export const resolveBreakpoint = (width: number): Breakpoint => {
	for (let index = breakpointOrder.length - 1; index >= 0; index -= 1) {
		const breakpoint = breakpointOrder[index];
		if (width >= breakpoints[breakpoint]) return breakpoint;
	}

	return "sm";
};

export const isBreakpointAtLeast = (current: Breakpoint, target: Breakpoint) =>
	breakpointOrder.indexOf(current) >= breakpointOrder.indexOf(target);

const getSnapshot = () => resolveBreakpoint(window.innerWidth);
const getServerSnapshot = () => SERVER_BREAKPOINT;

export const useBreakpoint = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const useBreakpointAtLeast = (target: Breakpoint) => isBreakpointAtLeast(useBreakpoint(), target);

export type { Breakpoint } from "@core-ui/constants/breakpoints";
