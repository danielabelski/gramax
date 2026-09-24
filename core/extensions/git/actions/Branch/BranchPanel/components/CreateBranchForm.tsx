import getNewBranchNameErrorLocalization from "@ext/git/actions/Branch/components/logic/getNewBranchNameErrorLocalization";
import validateBranchError from "@ext/git/actions/Branch/components/logic/validateBranchError";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Collapsible, CollapsibleContent } from "@ui-kit/Collapsible";
import { PopoverInput } from "@ui-kit/Input";
import { useEffect, useRef, useState } from "react";

type CreateBranchFormProps = {
	isOpen: boolean;
	existingBranches: string[];
	isDisabled: boolean;
	onCreate: (branchName: string) => void;
};

export const CreateBranchForm = ({ isOpen, existingBranches, isDisabled, onCreate }: CreateBranchFormProps) => {
	const [branchName, setBranchName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) inputRef.current?.focus();
		else setBranchName("");
	}, [isOpen]);

	const error = branchName
		? getNewBranchNameErrorLocalization(validateBranchError(branchName, existingBranches))
		: "";
	const canCreate = !!branchName && !error && !isDisabled;

	const create = () => {
		if (canCreate) onCreate(branchName);
	};

	return (
		<Collapsible open={isOpen}>
			<CollapsibleContent>
				<div className="flex flex-col gap-2 px-1 pt-2">
					<PopoverInput
						data-qa="input-new-branch"
						error={error}
						onChange={(value) => setBranchName(value ?? "")}
						onKeyDown={(event) => event.key === "Enter" && create()}
						placeholder={t("enter-branch-name")}
						ref={inputRef}
						value={branchName}
					/>
					{error && <span className="text-destructive text-xs">{error}</span>}
					<Button
						className="w-full shadow-none"
						data-testid="create-branch-submit"
						disabled={!canCreate}
						onClick={create}
						startIcon="plus"
					>
						{t("create-branch")}
					</Button>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
};
