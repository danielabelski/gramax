import { createContext, useContext, useEffect } from "react";

/**
 * Bridges a level body (workspace/catalog) that owns its own react-hook-form
 * to AppSettingsEditor's unsaved-changes guard, which otherwise only sees the
 * app-level form. The active child reports its dirty state, so closing the
 * modal with unsaved child edits still raises the guard.
 */
type SettingsDirtyContextValue = {
	reportDirty: (dirty: boolean) => void;
};

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null);

export const SettingsDirtyProvider = SettingsDirtyContext.Provider;

/**
 * Reports `isDirty` up to the guard whenever it changes, and resets to `false`
 * on unmount. No-op when rendered outside AppSettingsEditor (standalone use).
 */
export const useReportSettingsDirty = (isDirty: boolean) => {
	const ctx = useContext(SettingsDirtyContext);
	useEffect(() => {
		ctx?.reportDirty(isDirty);
		return () => ctx?.reportDirty(false);
	}, [ctx, isDirty]);
};
