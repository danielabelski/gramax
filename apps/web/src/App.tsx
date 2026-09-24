import preventFileDropNavigation from "@core-ui/utils/preventFileDropNavigation";
import { usePluginEvent } from "@plugins/api/events";
import { Toaster } from "@ui-kit/Toast";
import { useEffect } from "react";
import { Router } from "wouter";
import AppError from "./components/Atoms/AppError";
import AppLoader from "./components/Atoms/AppLoader";
import Gramax from "./Gramax";
import usePageData from "./hooks/usePageData";
// biome-ignore lint/style/noRestrictedImports: CSS-only import for theme variables
import "ics-ui-kit/theme.css";
import "../../../core/ui-kit/index.css";
import { useApplyTheme } from "@ext/Theme/utils";

const AppContext = () => {
	const { data, error, viewKey, refresh, setData, setLocation } = usePageData();

	useApplyTheme();
	usePluginEvent("app:open", data);
	usePluginEvent("app:close");

	if (!data) return error ? <AppError error={error} /> : <AppLoader />;

	return (
		<Router hook={() => [data.path, setLocation]}>
			<Gramax data={data} refresh={refresh} setData={setData} viewKey={viewKey} />
		</Router>
	);
};

const App = () => {
	useEffect(() => {
		preventFileDropNavigation();
	}, []);

	return (
		<>
			<Toaster />
			<AppContext />
		</>
	);
};

export default App;
