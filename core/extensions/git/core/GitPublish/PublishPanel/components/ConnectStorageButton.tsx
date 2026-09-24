import SourceDataService from "@core-ui/ContextServices/SourceDataService";
import { useValidateSource } from "@ext/git/actions/Source/logic/useValidateSource";
import t from "@ext/localization/locale/translate";
import CreateStorage from "@ext/storage/components/CreateStorage";
import useSourceData from "@ext/storage/components/useSourceData";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import removeSourceTokenIfInvalid from "@ext/storage/logic/utils/removeSourceTokenIfInvalid";
import { Button } from "@ui-kit/Button";

export const ConnectStorageButton = () => {
	const data = removeSourceTokenIfInvalid(useSourceData());
	const sourceDatas = SourceDataService.value;
	const validateSource = useValidateSource();

	return (
		<CreateStorage
			data={data}
			onSubmit={async (data: SourceData) => {
				await validateSource(data, sourceDatas);
			}}
			sourceType={data?.sourceType}
			trigger={
				<Button className="w-full shadow-none" startIcon="plug">
					{t("connect-storage")}
				</Button>
			}
		/>
	);
};
