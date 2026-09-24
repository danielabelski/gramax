import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { Level, traced } from "@ext/loggers/opentelemetry";
import type { UploadStatus } from "@ext/static/logic/CloudUploadStatus";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 500;

const useUploadProgress = (startUploading: boolean, setError?: (error: string) => void) => {
	const [data, setData] = useState<UploadStatus>({ status: null });
	const apiUrlCreator = ApiUrlCreatorService.value;

	// biome-ignore lint/correctness/useExhaustiveDependencies(setError): колбэк только вызывается; в зависимостях инлайновая функция перезапускала бы поллинг на каждый рендер
	useEffect(() => {
		if (!startUploading) return;

		setData({ status: null });

		let cancelled = false;
		// Статус живёт на сервере только пока идёт публикация: на фазе сборки его ещё нет,
		// а по завершении upload-команда удаляет его в finally. Поэтому пустой ответ —
		// признак завершения только после того, как статус хотя бы раз пришёл.
		let statusSeen = false;
		let intervalIdx: ReturnType<typeof setInterval>;

		const stop = () => {
			cancelled = true;
			clearInterval(intervalIdx);
		};

		const poll = async () => {
			try {
				await traced("cloud-upload-status-poll", { level: Level.Internal }, async () => {
					const res = await FetchService.fetch<UploadStatus>(apiUrlCreator.getUploadStatus());
					if (cancelled || !res.ok) return;

					const status = await res.json();
					if (cancelled) return;

					if (!status) {
						if (statusSeen) stop();
						return;
					}

					statusSeen = true;
					setData(status);

					if (status.status === "error") {
						stop();
						setError?.(status.error);
					}
				});
			} catch {
				// Колбэк интервала асинхронный: реджект здесь стал бы unhandled rejection.
				// Исключение уже записано в span внутри traced.
			}
		};

		intervalIdx = setInterval(poll, POLL_INTERVAL_MS);
		return stop;
	}, [startUploading]);

	return data;
};

export default useUploadProgress;
