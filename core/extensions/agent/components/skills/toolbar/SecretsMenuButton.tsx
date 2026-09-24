import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { openAgentSecretsSettings } from "@ext/agent/components/utils/openAgentSecretsSettings";
import { SECRET_FIELDS_BY_KIND } from "@ext/agent/components/utils/secret/secretFields";
import { useAgentSecretsSummary } from "@ext/agent/components/utils/secret/useAgentSecretsSummary";
import t from "@ext/localization/locale/translate";
import { getSecretFieldLabel } from "@ext/markdown/elements/secret/edit/logic/secretFields";
import type { Editor } from "@tiptap/core";
import {
	DropdownMenuEmptyItem,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { Loader } from "@ui-kit/Loader";
import { memo, useCallback } from "react";

interface SecretsMenuButtonProps {
	editor: Editor;
}

const SecretsMenuButton = ({ editor }: SecretsMenuButtonProps) => {
	const { secrets, isLoading } = useAgentSecretsSummary();
	const isCloud = !!PageDataContextService.value?.conf?.enterpriseCloud?.url;

	const insertSecret = useCallback(
		(key: string, field: string) => {
			editor
				.chain()
				.focus()
				.setSecret({ name: `${key}.${field}` })
				.run();
		},
		[editor],
	);

	const openSecretsSettings = useCallback(() => {
		openAgentSecretsSettings(isCloud);
	}, [isCloud]);

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<div className="flex flex-row items-center gap-2 w-full">
					<Icon icon="key-round" />
					{t("editor.keys-and-passwords.name")}
				</div>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="shadow-hard-base min-w-56" sideOffset={8}>
				{isLoading ? (
					<div className="flex justify-center p-2">
						<Loader size="sm" />
					</div>
				) : (
					<>
						{secrets.length === 0 ? (
							<DropdownMenuEmptyItem>{t("editor.keys-and-passwords.empty")}</DropdownMenuEmptyItem>
						) : (
							secrets.map((secret) => {
								const fields = SECRET_FIELDS_BY_KIND[secret.kind];
								if (fields.length === 1) {
									const [field] = fields;
									return (
										<DropdownMenuItem
											key={secret.key}
											onSelect={() => insertSecret(secret.key, field)}
										>
											<span className="truncate">{secret.key}</span>
										</DropdownMenuItem>
									);
								}

								return (
									<DropdownMenuSub key={secret.key}>
										<DropdownMenuSubTrigger>
											<span className="truncate">{secret.key}</span>
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="shadow-hard-base min-w-56" sideOffset={8}>
											{fields.map((field) => (
												<DropdownMenuItem
													key={field}
													onSelect={() => insertSecret(secret.key, field)}
												>
													<span className="truncate">{getSecretFieldLabel(field)}</span>
												</DropdownMenuItem>
											))}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								);
							})
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={openSecretsSettings}>
							<div className="flex flex-row items-center gap-2 w-full">
								<Icon icon="settings" />
								{t("app-settings.keys-passwords.manage")}
							</div>
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
};

export default memo(SecretsMenuButton);
