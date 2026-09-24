import validateEmail from "@core/utils/validateEmail";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { type FoundBillingRequisites, GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { zodResolver } from "@hookform/resolvers/zod";
import { AsyncSearchSelect, type LoadOptionsParams, type LoadOptionsResult } from "@ui-kit/AsyncSearchSelect";
import { Button, LoadingButtonTemplate } from "@ui-kit/Button";
import { Dialog, DialogBody, DialogContent } from "@ui-kit/Dialog";
import { Form, FormField, FormFooter, FormHeader, FormStack } from "@ui-kit/Form";
import { Input } from "@ui-kit/Input";
import type { RenderOptionProps } from "@ui-kit/LazySearchSelect";
import type { SearchSelectOption } from "@ui-kit/SearchSelect";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface LegalEntitySwitchModalProps {
	onClose: () => void;
	onSuccess?: () => Promise<void> | void;
	title?: string;
	submitLabel?: string;
}

type LegalEntityRequisitesOption = {
	label: string;
	value: string;
	requisites: FoundBillingRequisites;
};

export const LegalEntitySwitchModal = ({ onClose, onSuccess, title, submitLabel }: LegalEntitySwitchModalProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [open, setOpen] = useState(true);
	const [options, setOptions] = useState<LegalEntityRequisitesOption[]>([]);
	const [selected, setSelected] = useState<FoundBillingRequisites | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const onOpenChangeHandler = useCallback(
		(value: boolean) => {
			setOpen(value);
			if (!value) onClose();
		},
		[onClose],
	);

	const formSchema = z.object({
		documentEmail: z
			.string()
			.trim()
			.refine((email) => validateEmail(email), {
				message: t("enterprise-guest.validationErrors.emailInvalidFormat"),
			}),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		defaultValues: {
			documentEmail: "",
		},
	});

	const email = form.watch("documentEmail");
	const isSubmitDisabled = !email || !selected || isLoading || !form.formState.isValid;

	const abortController = useRef<AbortController>(null);

	const loadRequisites = useCallback(
		async (searchQuery: string): Promise<FoundBillingRequisites[]> => {
			try {
				if (abortController.current) abortController.current.abort();
				abortController.current = new AbortController();

				let fetchResult: FoundBillingRequisites[] = [];

				if (searchQuery.trim()) {
					fetchResult = await gesCloudApi.searchLegalEntityRequisites(
						searchQuery,
						abortController.current.signal,
					);
					setOptions(fetchResult.map(toOption));
				}

				return fetchResult;
			} catch (e) {
				if (e.name !== "AbortError")
					setError(t("enterprise-cloud.org-settings.billing.legal-entity.search-error"));
			}
		},
		[gesCloudApi],
	);

	const getRequisitesAsSearchSelectOptions = useCallback(
		async ({ searchQuery }: LoadOptionsParams): Promise<LoadOptionsResult<SearchSelectOption>> => {
			const fetchResult: FoundBillingRequisites[] = await loadRequisites(searchQuery);
			return {
				options: fetchResult
					? fetchResult?.map<SearchSelectOption>((option: FoundBillingRequisites) => ({
							value: getRequisiteId(option),
							label: `${option.fullName} (${option.inn})`,
						}))
					: [],
			};
		},
		[loadRequisites],
	);

	const handleSelect = useCallback(
		(requisite: SearchSelectOption) => {
			setSelected(options.find((option) => option.value === requisite.value)?.requisites ?? null);
			setError(null);
		},
		[options],
	);

	const handleSubmit = useCallback(
		async (data: z.infer<typeof formSchema>) => {
			if (!selected || !data.documentEmail || isLoading) return;

			setIsLoading(true);
			setError(null);
			try {
				await gesCloudApi.switchToLegalEntity({ ...selected, documentEmail: data.documentEmail });
				await onSuccess?.();
				onOpenChangeHandler(false);
			} catch {
				setError(t("enterprise-cloud.org-settings.billing.legal-entity.submit-error"));
				setIsLoading(false);
			}
		},
		[gesCloudApi, selected, isLoading, onSuccess, onOpenChangeHandler],
	);

	const handleCancel = useCallback(() => {
		if (!isLoading) onOpenChangeHandler(false);
	}, [isLoading, onOpenChangeHandler]);

	return (
		<Dialog onOpenChange={onOpenChangeHandler} open={open}>
			<DialogContent data-modal-root>
				<Form asChild {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)}>
						<FormHeader
							icon="building-2"
							title={title ?? t("enterprise-cloud.org-settings.billing.legal-entity.title")}
						/>
						<DialogBody>
							{error && <div className="mb-3 text-destructive text-sm">{error}</div>}
							<div className="flex flex-col gap-4">
								<FormStack>
									<AsyncSearchSelect
										loadOptions={getRequisitesAsSearchSelectOptions}
										onChange={handleSelect}
										placeholder={t(
											"enterprise-cloud.org-settings.billing.legal-entity.reqs-select.placeholder",
										)}
										renderOption={(data: RenderOptionProps<LegalEntityRequisitesOption>) => {
											const { option } = data;

											if (data.type === "trigger") {
												return (
													<TextOverflowTooltip className="self-center" data-qa="qa-clickable">
														{option.label}
													</TextOverflowTooltip>
												);
											}

											return <TextOverflowTooltip>{option.label}</TextOverflowTooltip>;
										}}
										value={
											selected
												? {
														value: getRequisiteId(selected),
														label: selected.fullName,
													}
												: null
										}
									/>
									<FormField
										control={({ field }) => (
											<Input
												{...field}
												placeholder={t(
													"enterprise-cloud.org-settings.billing.legal-entity.email-input.placeholder",
												)}
												type="email"
											/>
										)}
										layout="vertical"
										name="documentEmail"
										required
										title={t(
											"enterprise-cloud.org-settings.billing.legal-entity.email-input.title",
										)}
									/>
								</FormStack>

								{selected && <SelectedRequisites email={email} requisites={selected} />}
							</div>
						</DialogBody>
						<FormFooter
							primaryButton={
								isLoading ? (
									<LoadingButtonTemplate
										text={
											submitLabel ??
											t("enterprise-cloud.org-settings.billing.legal-entity.submit")
										}
										variant="primary"
									/>
								) : (
									<Button disabled={isSubmitDisabled} type="submit">
										{submitLabel ?? t("enterprise-cloud.org-settings.billing.legal-entity.submit")}
									</Button>
								)
							}
							secondaryButton={
								<Button disabled={isLoading} onClick={handleCancel} type="button" variant="outline">
									{t("cancel")}
								</Button>
							}
						/>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};

const SelectedRequisites = ({ requisites, email }: { requisites: FoundBillingRequisites; email: string }) => (
	<div className="flex flex-col gap-2 rounded-lg border p-4">
		<RequisitesRow
			label={t("enterprise-cloud.org-settings.billing.legal-entity.type")}
			value={
				requisites.type === "company"
					? t("enterprise-cloud.org-settings.billing.legal-entity.company")
					: t("enterprise-cloud.org-settings.billing.legal-entity.individual-entrepreneur")
			}
		/>
		<RequisitesRow
			label={t("enterprise-cloud.org-settings.billing.legal-entity.full-name")}
			value={requisites.fullName}
		/>
		<RequisitesRow label={t("enterprise-cloud.org-settings.billing.legal-entity.inn")} value={requisites.inn} />
		{requisites.type === "company" && (
			<RequisitesRow label={t("enterprise-cloud.org-settings.billing.legal-entity.kpp")} value={requisites.kpp} />
		)}
		<RequisitesRow
			label={t("enterprise-cloud.org-settings.billing.legal-entity.registered-address")}
			value={requisites.registeredAddress}
		/>
		<RequisitesRow label={t("enterprise-cloud.org-settings.billing.legal-entity.document-email")} value={email} />
	</div>
);

const RequisitesRow = ({ label, value }: { label: string; value: string }) => (
	<div className="flex items-start justify-between gap-4 text-sm">
		<span className="text-muted-foreground">{label}</span>
		<span className="text-right">{value}</span>
	</div>
);

const toOption = (requisites: FoundBillingRequisites): LegalEntityRequisitesOption => ({
	label: requisites.fullName,
	value: getRequisiteId(requisites),
	requisites,
});

const getRequisiteId = (req: FoundBillingRequisites): string => `${req.inn}-${req.kpp ?? ""}`;
