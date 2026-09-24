import { cn } from "@core-ui/utils/cn";
import NetworkConnectionWatcher from "@ext/errorHandlers/network/NetworkConnectionWatcher";
import t from "@ext/localization/locale/translate";
import { GlassToolbarButton, GlassToolbarIcon } from "@ui-kit/GlassToolbar";
import { useState } from "react";

export const OfflineButton = () => {
	const [isReconnecting, setIsReconnecting] = useState(false);

	const reconnect = async () => {
		setIsReconnecting(true);
		await NetworkConnectionWatcher.manualRetry();
		await new Promise((resolve) => setTimeout(resolve, 500));
		setIsReconnecting(false);
	};

	return (
		<GlassToolbarButton onClick={reconnect} tooltipText={t("sync-offline")}>
			<GlassToolbarIcon
				className={cn(isReconnecting && "animate-wifi-pulse")}
				icon={isReconnecting ? "wifi" : "wifi-off"}
			/>
		</GlassToolbarButton>
	);
};
