import t from "@ext/localization/locale/translate";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { AlertConfirm } from "@ui-kit/AlertDialog";
import { IconButton } from "@ui-kit/Button";
import { EmptyState } from "@ui-kit/EmptyState";
import { Input, SecretInput } from "@ui-kit/Input";
import { Loader } from "@ui-kit/Loader";
import { OffsetScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-kit/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui-kit/Table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useEffect, useState } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import type { AgentSecretsFormData, SecretKind } from "./secretRow";
import { useAgentSecretsTableVirtualizer } from "./useAgentSecretsTableVirtualizer";

type DraftFocusField = "key" | "login" | "value" | "url";

const COLUMN_COUNT = 6;

const SecretsLoadingRow = () => (
	<TableRow className="hover:bg-transparent">
		<TableCell className="h-[84px] text-center" colSpan={COLUMN_COUNT}>
			<Loader>{t("loading")}</Loader>
		</TableCell>
	</TableRow>
);

const SecretsEmptyRow = () => (
	<TableRow className="hover:bg-transparent">
		<TableCell className="h-[84px] text-center p-0" colSpan={COLUMN_COUNT}>
			<EmptyState className="p-0">{t("empty")}</EmptyState>
		</TableCell>
	</TableRow>
);

interface AgentSecretsTableRowProps {
	form: UseFormReturn<AgentSecretsFormData>;
	index: number;
	onFieldCommit: (index: number) => Promise<boolean>;
	onDeleteRow: (index: number) => void;
	autoFocusField?: DraftFocusField | null;
	onAutoFocusHandled?: () => void;
	virtualIndex: number;
	measureElementRef: (element: HTMLTableRowElement | null) => void;
}

const AgentSecretsTableRow = ({
	form,
	index,
	onFieldCommit,
	onDeleteRow,
	autoFocusField,
	onAutoFocusHandled,
	virtualIndex,
	measureElementRef,
}: AgentSecretsTableRowProps) => {
	const kind = useWatch({ control: form.control, name: `rows.${index}.kind` });
	const isLogin = kind === "login";

	/** Focuses the requested field through RHF's own registry rather than a plain `autoFocus` prop —
	 *  `autoFocus` only fires when the element first mounts, which misses the case where the target
	 *  row was already on screen (e.g. a missing-secret warning pointing at an existing key). */
	useEffect(() => {
		if (!autoFocusField) return;
		form.setFocus(`rows.${index}.${autoFocusField}`);
		onAutoFocusHandled?.();
	}, [autoFocusField, form, index, onAutoFocusHandled]);

	/** Commits once focus actually leaves the row, regardless of which field was edited last — a
	 *  per-field `onBlur` would miss whichever field the user happens to finish on. */
	const commitOnRowBlur = (event: React.FocusEvent<HTMLTableRowElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
		void onFieldCommit(index);
	};

	const commitOnEnter = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		event.stopPropagation();

		void (async () => {
			const committed = await onFieldCommit(index);
			if (committed) (event.target as HTMLElement).blur();
		})();
	};

	return (
		<TableRow
			data-index={virtualIndex}
			onBlur={commitOnRowBlur}
			onKeyDownCapture={commitOnEnter}
			ref={measureElementRef}
		>
			<TableCell className="w-28">
				<Controller
					control={form.control}
					name={`rows.${index}.kind`}
					render={({ field }) => (
						<Select
							onValueChange={(value: SecretKind) => {
								field.onChange(value);
								void form.trigger(`rows.${index}`);
							}}
							value={field.value}
						>
							<SelectTrigger aria-label={t("app-settings.keys-passwords.kind-label")} className="w-full">
								<SelectValue className="truncate" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="token">{t("app-settings.keys-passwords.kind-token")}</SelectItem>
								<SelectItem value="login">{t("app-settings.keys-passwords.kind-login")}</SelectItem>
							</SelectContent>
						</Select>
					)}
				/>
			</TableCell>
			<TableCell className="w-60">
				<Controller
					control={form.control}
					name={`rows.${index}.key`}
					render={({ field, fieldState }) => {
						// A duplicate key is reported by the tooltip alone — no field in this table paints the
						// red error border, so `error` is never passed to an Input. Zod's `superRefine`-raised
						// duplicate issue always types as "custom"; `key.min(1)` types as "too_small" — see
						// agentSecretsFormSchema.
						const isDuplicate = fieldState.error?.type === "custom";
						return (
							// Tooltip/TooltipTrigger/span always wrap Input (open just toggles) — conditionally
							// swapping the wrapper in and out would remount the <input> DOM node and drop focus
							// the moment an error appears while the user is still typing.
							<Tooltip open={isDuplicate}>
								<TooltipTrigger asChild>
									<span className="block w-full">
										<Input
											{...field}
											autoComplete="off"
											placeholder={t("app-settings.keys-passwords.key-placeholder")}
										/>
									</span>
								</TooltipTrigger>
								{isDuplicate && <TooltipContent>{fieldState.error?.message}</TooltipContent>}
							</Tooltip>
						);
					}}
				/>
			</TableCell>
			<TableCell className="w-60">
				<Controller
					control={form.control}
					name={`rows.${index}.login`}
					render={({ field }) => {
						const input = (
							<Input
								{...field}
								autoComplete="off"
								disabled={!isLogin}
								value={isLogin ? field.value : ""}
							/>
						);

						if (isLogin) return input;

						return (
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="block w-full">{input}</span>
								</TooltipTrigger>
								<TooltipContent>
									{t("app-settings.keys-passwords.login-disabled-tooltip")}
								</TooltipContent>
							</Tooltip>
						);
					}}
				/>
			</TableCell>
			<TableCell className="w-60">
				<Controller
					control={form.control}
					name={`rows.${index}.url`}
					render={({ field, fieldState }) => (
						<Input {...field} autoComplete="off" error={fieldState.error?.message} />
					)}
				/>
			</TableCell>
			<TableCell className="w-60">
				<Controller
					control={form.control}
					name={`rows.${index}.value`}
					render={({ field }) => (
						<SecretInput
							autoComplete="new-password"
							className="[&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
							name={field.name}
							onBlur={field.onBlur}
							onChange={field.onChange}
							placeholder={t("app-settings.keys-passwords.value-placeholder")}
							ref={field.ref}
							value={field.value}
						/>
					)}
				/>
			</TableCell>
			<TableCell className="w-14 text-right">
				<IconButton
					aria-label={t("delete")}
					icon="trash"
					onClick={() => onDeleteRow(index)}
					size="sm"
					status="error"
					type="button"
					variant="text"
				/>
			</TableCell>
		</TableRow>
	);
};

interface AgentSecretsTableProps {
	form: UseFormReturn<AgentSecretsFormData>;
	rows: { id: string; index: number }[];
	onFieldCommit: (index: number) => Promise<boolean>;
	onDeleteRow: (index: number) => void;
	focusedRowId?: string | null;
	focusedField?: DraftFocusField | null;
	onDraftFocusHandled?: () => void;
	isLoading?: boolean;
}

const VirtualizedSecretRows = ({
	form,
	rows,
	onFieldCommit,
	onDeleteRow,
	focusedRowId,
	focusedField,
	onDraftFocusHandled,
	virtualizer,
	virtualItems,
}: Omit<AgentSecretsTableProps, "isLoading"> & {
	virtualizer: Virtualizer<HTMLDivElement, Element>;
	virtualItems: VirtualItem[];
}) => (
	<>
		<tr style={{ height: virtualItems[0]?.start ?? 0 }} />
		{virtualItems.map((virtualItem) => {
			const { id, index } = rows[virtualItem.index];
			return (
				<AgentSecretsTableRow
					autoFocusField={id === focusedRowId ? focusedField : null}
					form={form}
					index={index}
					key={id}
					measureElementRef={virtualizer.measureElement}
					onAutoFocusHandled={onDraftFocusHandled}
					onDeleteRow={onDeleteRow}
					onFieldCommit={onFieldCommit}
					virtualIndex={virtualItem.index}
				/>
			);
		})}
		<tr style={{ height: virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0) }} />
	</>
);

export const AgentSecretsTable = ({
	form,
	rows,
	onFieldCommit,
	onDeleteRow,
	focusedRowId,
	focusedField,
	onDraftFocusHandled,
	isLoading,
}: AgentSecretsTableProps) => {
	const { scrollRef, virtualizer } = useAgentSecretsTableVirtualizer(rows.length);
	const [pendingDelete, setPendingDelete] = useState<{ id: string; key: string; kind: SecretKind } | null>(null);

	// Only a row that already exists on the backend is worth confirming — a row that was never saved
	// has nothing to lose, so removing it stays a plain one-click undo. `savedKey` is also the key
	// deleteSecret actually deletes, so it is the right one to show even mid-rename.
	const requestRowDelete = useCallback(
		(index: number) => {
			const row = form.getValues(`rows.${index}`);
			if (!row?.savedKey) return onDeleteRow(index);
			setPendingDelete({ id: row.id, key: row.savedKey, kind: row.kind });
		},
		[form, onDeleteRow],
	);

	const confirmRowDelete = () => {
		const index = form.getValues("rows").findIndex((row) => row.id === pendingDelete?.id);
		setPendingDelete(null);
		if (index !== -1) onDeleteRow(index);
	};

	// Scrolls a target row into the virtualized window before the row's own mount effect can focus it
	// (e.g. clicking "add token" on a chat missing-secret warning for a key that already has a row,
	// possibly scrolled out of view). Only ensures the row mounts — the row's own effect still does
	// the actual `form.setFocus` once `autoFocusField` reaches it as a mount prop.
	useEffect(() => {
		if (!focusedRowId) return;
		const targetIndex = rows.findIndex((row) => row.id === focusedRowId);
		if (targetIndex === -1) return;
		virtualizer.scrollToIndex(targetIndex, { align: "center" });
	}, [focusedRowId, rows, virtualizer]);

	return (
		<>
			<div className="min-h-0 overflow-hidden rounded-lg border border-secondary-border [&_select]:appearance-none [&_input:not(:focus)]:!shadow-none [&_[role=combobox]:not(:focus)]:!shadow-none">
				<OffsetScrollShadowContainer
					className="h-full [&>div>div]:overflow-visible"
					ref={scrollRef}
					topOffset={41}
				>
					<Table className="w-full min-w-max table-fixed">
						<TableHeader className="sticky top-0 z-[1] [box-shadow:0_1px_0_0_hsl(var(--border))] [&_tr]:border-0">
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-28 px-3">
									{t("app-settings.keys-passwords.kind-label")}
								</TableHead>
								<TableHead className="w-60 px-3">
									{t("app-settings.keys-passwords.key-label")}
								</TableHead>
								<TableHead className="w-60 px-3">
									{t("app-settings.keys-passwords.login-label")}
								</TableHead>
								<TableHead className="w-60 px-3">
									{t("app-settings.keys-passwords.url-label")}
								</TableHead>
								<TableHead className="w-60 px-3">
									{t("app-settings.keys-passwords.value-label")}
								</TableHead>
								<TableHead className="w-14 px-3 text-right" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<SecretsLoadingRow />
							) : rows.length === 0 ? (
								<SecretsEmptyRow />
							) : (
								<VirtualizedSecretRows
									focusedField={focusedField}
									focusedRowId={focusedRowId}
									form={form}
									onDeleteRow={requestRowDelete}
									onDraftFocusHandled={onDraftFocusHandled}
									onFieldCommit={onFieldCommit}
									rows={rows}
									virtualItems={virtualizer.getVirtualItems()}
									virtualizer={virtualizer}
								/>
							)}
						</TableBody>
					</Table>
				</OffsetScrollShadowContainer>
			</div>
			{pendingDelete && (
				<AlertConfirm
					confirmText={t("delete")}
					description={t("app-settings.keys-passwords.delete-confirm-description").replace(
						"{{key}}",
						pendingDelete.key,
					)}
					icon="alert-circle"
					onCancel={() => setPendingDelete(null)}
					onConfirm={confirmRowDelete}
					status="warning"
					title={t(`app-settings.keys-passwords.delete-confirm-title-${pendingDelete.kind}`)}
				/>
			)}
		</>
	);
};
