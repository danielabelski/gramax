import { useRouter } from "@core/Api/useRouter";
import Path from "@core/FileProvider/Path/Path";
import { useEditLfsOptions } from "@core/GitLfs/hooks/useEditLfsOptions";
import { customLfsExclude } from "@core/GitLfs/logic/autoLfsAttachments";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import type { ClientCatalogProps } from "@core/SitePresenter/SitePresenter";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import CatalogLogoService from "@core-ui/ContextServices/CatalogLogoService/Context";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import type { LogoState } from "@ext/catalog/actions/propsEditor/components/UploadCatalogLogo";
import type { FormData } from "@ext/catalog/actions/propsEditor/logic/createFormSchema";
import getCatalogEditProps from "@ext/catalog/actions/propsEditor/logic/getCatalogEditProps";
import type CatalogEditProps from "@ext/catalog/actions/propsEditor/model/CatalogEditProps";
import {
	getLogoEmoji,
	isLogoEmoji,
	isLogoIcon,
	makeLogoEmoji,
	makeLogoIcon,
	parseLogoIcon,
} from "@ext/catalog/logo/catalogLogoIcon";
import ErrorConfirmService from "@ext/errorHandlers/client/ErrorConfirmService";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import tryOpenMergeConflict from "@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeConflict";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import type { LfsAutoAttachmentsDialogProps } from "@ext/git/actions/Sync/components/LfsAutoAttachmentsDialog";
import {
	requestAttachmentsMigrationStats,
	requestEnableAutoLfsAttachments,
} from "@ext/git/actions/Sync/logic/autoLfsAttachmentsRequests";
import type { IconPickerColor } from "@ext/markdown/elements/icon/edit/components/IconPicker/IconPicker";
import type { IconEditorProps } from "@ext/markdown/elements/icon/edit/model/types";
import Theme from "@ext/Theme/Theme";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

const logoToFormState = (logo: string, fallback: string): LogoState => {
	if (!logo) return null;
	if (isLogoIcon(logo)) {
		const { code, color } = parseLogoIcon(logo);
		return { type: "icon", code, color: (color ?? null) as IconPickerColor };
	}
	if (isLogoEmoji(logo)) return { type: "emoji", emoji: getLogoEmoji(logo) };
	return fallback ? { type: "file", preview: fallback, content: undefined, file: null } : null;
};

type ExtendedCatalogEditProps = Omit<CatalogEditProps, "logo" | "logo_dark" | "lfs"> & {
	icons: { name: string; content: string; size: number; type: string }[];
	logo?: {
		light?: LogoState;
		dark?: LogoState;
	};
	lfs?: { patterns?: string[]; lazy?: boolean; auto?: boolean; exclude?: string[] };
};

const hasLogoField = (
	logoData: ExtendedCatalogEditProps["logo"],
	theme: "light" | "dark",
): logoData is NonNullable<ExtendedCatalogEditProps["logo"]> =>
	Boolean(logoData && Object.hasOwn(logoData, theme) && logoData[theme] !== undefined);

interface UseCatalogPropsEditorActionsReturn {
	allCatalogNames: string[];
	open: boolean;
	setOpen: (value: boolean) => void;
	getOriginalProps: () => Promise<ExtendedCatalogEditProps>;
	onSubmit: (newProps: ExtendedCatalogEditProps, defaultValues: ExtendedCatalogEditProps) => Promise<void>;
	isLoading: boolean;
	error: string | null;
	onToggleAutoLfs: (form: UseFormReturn<FormData>) => (next: boolean) => void;
	autoLfsChecking: boolean;
	/** Whether the last read of the catalog's LFS state answered. While it did not, the form's `lfs` is a zod default. */
	lfsKnown: boolean;
}

export const useCatalogPropsEditorActions = (onClose: () => void): UseCatalogPropsEditorActionsReturn => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const catalogProps = useCatalogPropsStore((state) => state, "shallow");
	const logicPath = useArticlePropsStore((s) => s.data.logicPath);
	const { darkLogo, lightLogo, refreshState, refreshLogo } = CatalogLogoService.value();
	const router = useRouter();

	const [open, setOpenInner] = useState(true);
	const autoLfsModalId = useRef<string | null>(null);
	const [autoLfsChecking, setAutoLfsChecking] = useState(false);
	const autoLfsCheckingRef = useRef(false);
	const [allCatalogNames, setAllCatalogNames] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lfsKnown, setLfsKnown] = useState(false);

	const { getLfsOptions, updateLfsOptions, allowed: allowedEditLfsOptions } = useEditLfsOptions();

	const getOriginalProps = useCallback(async (): Promise<ExtendedCatalogEditProps> => {
		const res = await FetchService.fetch(apiUrlCreator.getCustomIconsList());
		const { logo, logo_dark, lfs: _autoLfs, ...baseProps } = getCatalogEditProps(catalogProps.data);
		if (!res.ok) {
			setLfsKnown(false);
			return { ...baseProps, icons: [] };
		}
		const icons = (await res.json()) ?? [];

		const lfsOptions = allowedEditLfsOptions ? await getLfsOptions() : null;
		// `getLfsOptions` answers `null` on a failed read, which is indistinguishable from "no masks" —
		// blessing that as `[]` would make the next Save strip every `filter=lfs` mask. Drop the key instead.
		const lfsUnknown = allowedEditLfsOptions && !lfsOptions;
		setLfsKnown(!lfsUnknown);
		const lfs = {
			patterns: lfsOptions?.patterns ?? [],
			lazy: lfsOptions?.lazy ?? true,
			auto: catalogProps.data?.lfs?.auto ?? false,
			// Only what this catalog adds: the defaults hold for every catalog and the editor shows them
			// locked, so a copy stored back would be the one thing able to drift from them.
			exclude: customLfsExclude(catalogProps.data?.lfs?.exclude),
		};

		return {
			...baseProps,
			logo: {
				light: logoToFormState(logo, lightLogo),
				dark: logoToFormState(logo_dark, darkLogo),
			},
			icons: icons.map((icon: IconEditorProps) => ({
				name: icon.code,
				content: icon.svg,
				size: icon.size,
				type: "image/svg+xml",
			})),
			filterProperty: baseProps.filterProperty
				? baseProps.properties?.find((p) => p.name === baseProps.filterProperty)?.name
				: null,
			...(lfsUnknown ? {} : { lfs }),
		};
	}, [catalogProps.data, allowedEditLfsOptions, getLfsOptions, lightLogo, darkLogo]);

	const fetchCatalogNames = useCallback(async () => {
		try {
			const response = await FetchService.fetch(apiUrlCreator.getCatalogBrotherFileNames());
			if (!response.ok) {
				throw new Error(`Failed to fetch catalog names: ${response.statusText}`);
			}
			const names = await response.json();
			setAllCatalogNames(names);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		}
	}, []);

	useEffect(() => {
		void fetchCatalogNames();
	}, [fetchCatalogNames]);

	const setOpen = useCallback(
		(value: boolean) => {
			if (value) setError(null);
			setOpenInner(value);
			if (!value) onClose?.();
		},
		[onClose],
	);

	const buildNewPath = useCallback(
		(newCatalogProps: ClientCatalogProps) => {
			const basePathName = new Path(newCatalogProps.link.pathname);
			const { filePath } = RouterPathProvider.parseItemLogicPath(new Path(logicPath));
			const isNewPath = RouterPathProvider.isEditorPathname(new Path(router.path).removeExtraSymbols);

			return isNewPath
				? RouterPathProvider.updatePathnameData(basePathName, { filePath }).value
				: Path.join(basePathName.value, ...filePath);
		},
		[router.path, logicPath],
	);

	const deleteIcons = useCallback(
		async (icons: { name: string; content: string }[], initialIcons: { name: string; content: string }[]) => {
			await initialIcons.forEachAsync(async (icon) => {
				if (icons.some((i) => i.content === icon.content)) return;
				await FetchService.fetch(apiUrlCreator.deleteCustomIcon(icon.name));
			});
		},
		[],
	);

	const uploadIcons = useCallback(async (icons: { name: string; content: string }[]) => {
		await icons.forEachAsync(async (icon) => {
			await FetchService.fetch(
				apiUrlCreator.createCustomIcon(),
				JSON.stringify({
					code: new Path(icon.name).name,
					svg: icon.content,
				}),
			);
		});
	}, []);

	const updateLogoFiles = useCallback(
		async (
			logoData: ExtendedCatalogEditProps["logo"],
			originalLogoName: string,
			originalLogoDarkName: string,
			catalogName: string,
		): Promise<{ logo?: string; logo_dark?: string }> => {
			const result: { logo?: string; logo_dark?: string } = {};

			const isUnchangedFileLogo = (state: LogoState): boolean =>
				state?.type === "file" && !state.content && !state.file;

			// Light and dark logos are separate files: one name for both makes the second upload
			// overwrite the first, and every catalog then shows the same logo in both themes.
			const getLogo = async (state: LogoState, theme: Theme): Promise<string> => {
				if (state.type === "icon") return makeLogoIcon(state.code, state.color);
				if (state.type === "emoji") return makeLogoEmoji(state.emoji);

				const ext = state.file?.name.split(".").pop() ?? "svg";
				const fileName = theme === Theme.dark ? `logo_dark.${ext}` : `logo.${ext}`;
				if (state.content) {
					await FetchService.fetch(apiUrlCreator.updateCatalogLogo(catalogName, fileName), state.content);
				}
				return fileName;
			};

			if (hasLogoField(logoData, "light") && !isUnchangedFileLogo(logoData.light)) {
				if (originalLogoName) {
					await FetchService.fetch(apiUrlCreator.deleteCatalogLogo(catalogName, Theme.light));
				}
				if (logoData.light) {
					result.logo = await getLogo(logoData.light, Theme.light);
				} else {
					result.logo = "";
				}
			}

			if (hasLogoField(logoData, "dark") && !isUnchangedFileLogo(logoData.dark)) {
				if (originalLogoDarkName) {
					await FetchService.fetch(apiUrlCreator.deleteCatalogLogo(catalogName, Theme.dark));
				}

				if (logoData.dark) {
					result.logo_dark = await getLogo(logoData.dark, Theme.dark);
				} else {
					result.logo_dark = "";
				}
			}

			return result;
		},
		[],
	);

	const onSubmit = useCallback(
		async (newProps: ExtendedCatalogEditProps, defaultValues: ExtendedCatalogEditProps) => {
			const originalProps: ExtendedCatalogEditProps = await getOriginalProps();

			const mergedProps = {
				...originalProps,
				...newProps,
			};

			const { logo: logoFormData, icons, lfs, ...restMergedProps } = mergedProps;

			// `getOriginalProps` omits `lfs` when it could not read the catalog's real LFS state, and the
			// schema's zod default then fills that gap with empty lists — saving those would strip every mask.
			// Both samples must carry it: `defaultValues` came from the mount fetch, `originalProps` from this one.
			const lfsSavable = Boolean(originalProps.lfs && defaultValues.lfs);

			setIsLoading(true);
			setError(null);

			try {
				await deleteIcons(icons, defaultValues.icons);
				await uploadIcons(icons);

				if (allowedEditLfsOptions && lfsSavable && lfs) {
					await updateLfsOptions({ patterns: lfs.patterns, lazy: lfs.lazy });
				}

				const logoProps = await updateLogoFiles(
					logoFormData,
					catalogProps.data.logo,
					catalogProps.data.logo_dark,
					catalogProps.data.name,
				);

				const propsToSend = {
					...restMergedProps,
					...logoProps,
					// `patterns` lives in `.gitattributes`; only the switch and its exclusions belong in props.
					...(lfsSavable ? { lfs: { auto: lfs?.auto ?? false, exclude: lfs?.exclude ?? [] } } : {}),
				};

				const response = await FetchService.fetch<ClientCatalogProps>(
					apiUrlCreator.updateCatalogProps(),
					JSON.stringify(propsToSend),
					MimeTypes.json,
				);

				if (!response.ok) {
					throw new Error(`Failed to update catalog props: ${response.statusText}`);
				}

				const newCatalogProps = await response.json();
				catalogProps.update(newCatalogProps);

				const newPath = buildNewPath(newCatalogProps);
				void router.pushPath(newPath);

				if (Object.keys(logoProps).length > 0) {
					await refreshState();
					await refreshLogo();
				}

				setOpen(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error occurred");
			} finally {
				setIsLoading(false);
			}
		},
		[
			getOriginalProps,
			buildNewPath,
			router,
			setOpen,
			deleteIcons,
			uploadIcons,
			allowedEditLfsOptions,
			updateLfsOptions,
			updateLogoFiles,
			catalogProps,
			refreshState,
			refreshLogo,
		],
	);

	const settleAutoLfs = useCallback(
		(form: UseFormReturn<FormData>) => (enabled: boolean, mergeData?: MergeData, patterns?: string[]) => {
			// Turning it on is saved by the command itself, before the migration — so the form only
			// mirrors what is already on disk.
			if (enabled) form.setValue("lfs.auto", true, { shouldDirty: false });
			// The migration added masks to `.gitattributes` after this form read it, so the form's next Save
			// would `setAttrMany` them away. Union in what the command reports, keeping the user's order first.
			if (patterns) {
				const current = form.getValues("lfs.patterns") ?? [];
				const merged = [...new Set([...current, ...patterns])];
				form.setValue("lfs.patterns", merged, { shouldDirty: false });
			}
			if (autoLfsModalId.current) ModalToOpenService.removeModal(autoLfsModalId.current);
			autoLfsModalId.current = null;
			tryOpenMergeConflict({ mergeData });
		},
		[],
	);

	const onToggleAutoLfs = useCallback(
		(form: UseFormReturn<FormData>) => (next: boolean) => {
			// Turning it off is an ordinary form field — it saves with the rest of the form.
			if (!next) return form.setValue("lfs.auto", false, { shouldDirty: true });
			// Without a read there is no mask list, so the form drops its whole `lfs` block on Save —
			// the exclusions the user edits here would migrate files and then not persist. The switch
			// is disabled for the same reason; this is the guard behind it.
			if (!lfsKnown) return;
			// The dialog is what keeps this form open, so a second entry would orphan the first. The ref,
			// not the state, guards the window before the re-render lands.
			if (autoLfsModalId.current || autoLfsCheckingRef.current) return;
			autoLfsCheckingRef.current = true;
			setAutoLfsChecking(true);

			const exclude = form.getValues("lfs.exclude") ?? [];

			void (async () => {
				try {
					const stats = await requestAttachmentsMigrationStats(apiUrlCreator, exclude);
					// `FetchService` already told the user why; the switch stays off because nothing was saved.
					if (!stats) return;

					if (stats.added.length) {
						autoLfsModalId.current = ModalToOpenService.addModal<LfsAutoAttachmentsDialogProps>(
							// Pushed onto the stack, not set as its only entry: this form is itself a
							// `ModalToOpenService` modal, and `setValue` would replace the whole stack.
							ModalToOpen.LfsAutoAttachments,
							{ apiUrlCreator, exclude, stats, onSettled: settleAutoLfs(form) },
						);
						return;
					}

					// Nothing to append, so nothing to warn about — the same command just saves the setting.
					const { enabled, mergeData, patterns } = await requestEnableAutoLfsAttachments(
						apiUrlCreator,
						exclude,
					);
					settleAutoLfs(form)(enabled, mergeData, patterns);
				} catch (e) {
					// `FetchService` only reports responses it received; a network throw would be silent.
					ErrorConfirmService.notify(new DefaultError(e instanceof Error ? e.message : String(e)));
				} finally {
					autoLfsCheckingRef.current = false;
					setAutoLfsChecking(false);
				}
			})();
		},
		[settleAutoLfs, lfsKnown],
	);

	return {
		allCatalogNames,
		open,
		setOpen,
		getOriginalProps,
		onSubmit,
		isLoading,
		error,
		onToggleAutoLfs,
		autoLfsChecking,
		lfsKnown,
	};
};
