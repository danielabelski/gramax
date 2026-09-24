import { refreshPage } from "@core-ui/utils/initGlobalFuncs";
import t from "@ext/localization/locale/translate";
import { applyLoggingPatch } from "@ext/loggers/opentelemetry/logLevel";
import { extractDefaults, getByPath } from "@ext/settings/logic/schemaUtils";
import { zodResolver } from "@hookform/resolvers/zod";
import { UnsavedChanges } from "@ui-kit/AlertDialog";
import { Button } from "@ui-kit/Button";
import { ErrorState } from "@ui-kit/ErrorState";
import { Form, FormFooter } from "@ui-kit/Form";
import { Loader } from "@ui-kit/Loader";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useStore } from "zustand";
import { getExecutingEnvironment } from "../../../../app/resolveModule/env";
import { AppSettings } from "../levels/app-settings";
import { cachedSettingsStore } from "../logic/cachedSettingsStore";
import { type AppSettingsFormData, createAppSettingsFormSchema, diffPatch } from "../logic/formSchema";
import { useResetSettings, useUpdateSettings } from "../logic/hooks";
import { ResetSettingsFormProvider } from "./ResetSettingsFormContext";
import { isResettable } from "./settingResetVisible";

type UseAppSettingsEditorFormParams = {
	onClose?: () => void;
};

const schemaDefaults = extractDefaults(AppSettings) as Record<string, unknown>;

const buildDefaults = (values: Record<string, unknown>): AppSettingsFormData => {
	// AI is configured at the workspace level (EditWorkspaceFormBody), so its
	// keys never reach the app-level form.
	const { ai: _ai, ...services } = (values.services ?? {}) as Record<string, unknown>;
	return {
		general: (values.general ?? {}) as AppSettingsFormData["general"],
		services: services as AppSettingsFormData["services"],
		"compress-images": {
			...(schemaDefaults["compress-images"] as AppSettingsFormData["compress-images"]),
			...((values["compress-images"] ?? {}) as Partial<AppSettingsFormData["compress-images"]>),
		},
		logging: (values.logging ?? schemaDefaults.logging) as AppSettingsFormData["logging"],
		contentCompare: {
			...(schemaDefaults.contentCompare as AppSettingsFormData["contentCompare"]),
			...((values.contentCompare ?? {}) as Partial<AppSettingsFormData["contentCompare"]>),
		},
	};
};

// First leaf validation error as `path: message`, walking RHF's nested errors.
const firstErrorPath = (errors: Record<string, unknown>, prefix = ""): string | null => {
	for (const [key, val] of Object.entries(errors ?? {})) {
		if (!val || key === "ref") continue;
		const path = prefix ? `${prefix}.${key}` : key;
		const message = (val as { message?: unknown }).message;
		if (typeof message === "string") return `${path}: ${message}`;
		if (typeof val === "object") {
			const nested = firstErrorPath(val as Record<string, unknown>, path);
			if (nested) return nested;
		}
	}
	return null;
};

export const useAppSettingsEditorForm = ({ onClose }: UseAppSettingsEditorFormParams) => {
	const [open, setOpen] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
	const [childDirty, setChildDirty] = useState(false);
	const pendingResetKeys = useRef(new Set<string>());

	const update = useUpdateSettings("app");
	const reset = useResetSettings("app");
	const schema = useMemo(() => createAppSettingsFormSchema(), []);
	// Subscribe to cached settings so the form picks up post-mount hydration.
	const values = useStore(cachedSettingsStore, (s) => s.appValues);
	const defaultValues = useMemo(() => buildDefaults(values as Record<string, unknown>), [values]);

	const form = useForm<AppSettingsFormData>({
		resolver: zodResolver(schema),
		defaultValues,
		mode: "onChange",
	});

	// Re-seed the form when settings hydrate after first paint, but never
	// clobber pending edits.
	useEffect(() => {
		if (!form.formState.isDirty) form.reset(defaultValues);
	}, [defaultValues, form]);

	useEffect(() => {
		if (!open) onClose?.();
	}, [open, onClose]);

	const getResetKeysForData = useCallback((data: Record<string, unknown>) => {
		return [...pendingResetKeys.current].filter((key) => {
			const value = getByPath(data, key);
			const defaultValue = getByPath(schemaDefaults, key);
			return !isResettable(value, defaultValue);
		});
	}, []);

	const persistFormData = useCallback(
		async (data: AppSettingsFormData) => {
			const patch = diffPatch(
				data as Record<string, unknown>,
				form.formState.defaultValues as Record<string, unknown>,
			);
			const resetKeys = getResetKeysForData(data as Record<string, unknown>);
			for (const key of resetKeys) delete patch[key];

			if (Object.keys(patch).length > 0) await update(patch);
			if (resetKeys.length > 0) await reset(resetKeys);
			pendingResetKeys.current.clear();
			form.reset(data);

			// Logging settings persist only here (on save), so their runtime side effects
			// (OTel SDK on/off, level push to Rust) fire now — reset keys land on their defaults.
			const runtimePatch = { ...patch };
			for (const key of resetKeys) runtimePatch[key] = getByPath(schemaDefaults, key);
			await applyLoggingPatch(runtimePatch);
		},
		[form, getResetKeysForData, reset, update],
	);

	const onSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			void form.handleSubmit(
				async (data) => {
					setSubmitError(null);
					setIsSaving(true);
					try {
						await persistFormData(data);
						refreshPage();
						setOpen(false);
					} finally {
						setIsSaving(false);
					}
				},
				(errors) => setSubmitError(firstErrorPath(errors) ?? t("error")),
			)(e);
		},
		[form, persistFormData],
	);

	// Workspace/catalog level bodies own their own form; they report dirtiness
	// so the guard covers them too, not just the app-level form.
	const isDirty = form.formState.isDirty || childDirty;

	const dirtyContextValue = useMemo(() => ({ reportDirty: setChildDirty }), []);

	// Log capture/export runs only in the browser and desktop apps — SSR/static builds have no diagnostics UI.
	const isDiagnosticsAvailable = () => {
		const environment = getExecutingEnvironment();
		return environment === "web" || environment === "tauri";
	};

	const resetFormContextValue = useMemo(
		() => ({
			markReset: (key: string) => {
				pendingResetKeys.current.add(key);
			},
		}),
		[],
	);

	const queuePendingAction = useCallback((action: () => void) => {
		setPendingAction(() => action);
	}, []);

	const onDialogOpenChange = useCallback(
		(next: boolean) => {
			if (!next && isDirty) {
				queuePendingAction(() => setOpen(false));
				return;
			}
			setOpen(next);
		},
		[isDirty, queuePendingAction],
	);

	const onCloseHandler = useCallback(() => setOpen(false), []);

	const renderAppForm = useCallback(
		(content: ReactNode) => (
			<FormProvider {...form}>
				<ResetSettingsFormProvider value={resetFormContextValue}>
					<Form asChild {...form}>
						<form className="flex flex-col h-full min-h-0" onSubmit={onSubmit}>
							<div className="flex flex-1 min-h-0 flex-col overflow-hidden">
								{content}
								{submitError && <ErrorState className="text-sm shrink-0">{submitError}</ErrorState>}
							</div>
							<FormFooter
								className="flex-shrink-0 !p-5"
								primaryButton={
									<Button disabled={isSaving} type="submit" variant="primary">
										{isSaving && <Loader size="sm" />}
										{t("save")}
									</Button>
								}
								secondaryButton={
									<Button onClick={onCloseHandler} type="button" variant="outline">
										{t("app-settings.actions.cancel")}
									</Button>
								}
							/>
						</form>
					</Form>
				</ResetSettingsFormProvider>
			</FormProvider>
		),
		[form, isSaving, onCloseHandler, onSubmit, resetFormContextValue, submitError],
	);

	const confirmationDialog = (
		<UnsavedChanges
			description={t("app-settings.exit-confirmation.body")}
			discardText={t("app-settings.exit-confirmation.exit")}
			keepEditingText={t("app-settings.exit-confirmation.keep-editing")}
			onDiscard={() => {
				form.reset(form.formState.defaultValues);
				pendingResetKeys.current.clear();
				pendingAction?.();
				setPendingAction(null);
			}}
			onOpenChange={(next) => {
				if (!next) setPendingAction(null);
			}}
			open={pendingAction !== null}
			title={t("app-settings.exit-confirmation.title")}
		/>
	);

	return {
		form,
		isDirty,
		open,
		setOpen,
		dirtyContextValue,
		onCloseHandler,
		onDialogOpenChange,
		queuePendingAction,
		renderAppForm,
		confirmationDialog,
		isDiagnosticsAvailable,
	};
};
