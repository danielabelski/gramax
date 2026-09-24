import { TableToolbar } from "@ext/enterprise/components/admin/ui-kit/table/TableToolbar";
import { TableToolbarTextInput } from "@ext/enterprise/components/admin/ui-kit/table/TableToolbarTextInput";
import t from "@ext/localization/locale/translate";
import SectionHeader from "@ext/settings/components/SectionHeader";
import { Button } from "@ui-kit/Button";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentSecretsTable } from "./AgentSecretsTable";
import { useAgentSecrets } from "./useAgentSecrets";

// Owns useAgentSecrets so session-restore/secrets-list only fire while this tab is actually open, not
// for every app-level settings tab. A row that can't be committed (empty/duplicate key) never blocks
// leaving the tab — it just doesn't persist, see useAgentSecrets. The unmount effect here covers the
// one case that does need saving: a valid-but-not-yet-committed row (still focused, blur hasn't fired)
// on tab switch/modal close.
const AgentSecretsSection = () => {
	const agentSecrets = useAgentSecrets();
	const {
		form,
		fields,
		secrets,
		isLoading,
		addDraftSecret,
		commitSecret,
		deleteSecret,
		focusedDraftRowId,
		focusedDraftField,
		clearFocusedDraft,
		save,
	} = agentSecrets;
	const [filterValue, setFilterValue] = useState("");

	const saveRef = useRef(save);
	useEffect(() => {
		saveRef.current = save;
	}, [save]);
	useEffect(() => () => void saveRef.current().catch(() => {}), []);

	const visibleRows = useMemo(() => {
		const query = filterValue.trim().toLowerCase();
		return fields
			.map((field, index) => ({ id: field.id, index }))
			.filter(({ index }) => {
				if (!query) return true;
				const row = secrets[index];
				return (
					row.key.toLowerCase().includes(query) ||
					row.login.toLowerCase().includes(query) ||
					row.url.toLowerCase().includes(query)
				);
			});
	}, [fields, secrets, filterValue]);

	return (
		<div className="flex flex-col flex-1 min-h-0 gap-5">
			<SectionHeader
				description={t("app-settings.keys-passwords.description")}
				title={t("app-settings.keys-passwords.title")}
			/>

			<div className="flex flex-col flex-1 min-h-0">
				<TableToolbar
					className="pt-0"
					input={
						<TableToolbarTextInput
							onChange={(value) => setFilterValue(value ?? "")}
							placeholder={t("app-settings.keys-passwords.search-placeholder")}
							value={filterValue}
						/>
					}
				>
					<Button onClick={() => addDraftSecret()} startIcon="plus" type="button" variant="outline">
						{t("app-settings.keys-passwords.add")}
					</Button>
				</TableToolbar>

				<AgentSecretsTable
					focusedField={focusedDraftField}
					focusedRowId={focusedDraftRowId}
					form={form}
					isLoading={isLoading}
					onDeleteRow={deleteSecret}
					onDraftFocusHandled={clearFocusedDraft}
					onFieldCommit={commitSecret}
					rows={visibleRows}
				/>
			</div>
		</div>
	);
};

export default AgentSecretsSection;
