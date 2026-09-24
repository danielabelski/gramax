import { isActive, isPaused } from "@core-ui/hooks/useAudioRecorder";
import useWatch from "@core-ui/hooks/useWatch";
import AudioRecorderService from "@ext/ai/components/Audio/AudioRecorderService";
import Timer from "@ext/ai/components/Audio/Timer";
import AudioHistory from "@ext/ai/components/Audio/Visualizer/AudioHistory";
import CanvasVisualizator from "@ext/ai/components/Audio/Visualizer/CanvasVisualizator";
import { AiToolbarButton } from "@ext/ai/components/Helpers/AiToolbarButton";
import type { AudioHistoryItem } from "@ext/ai/models/types";
import t from "@ext/localization/locale/translate";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useCallback, useEffect, useRef, useState } from "react";

export interface VisualizerProps {
	startTime?: number;
	maxDurationMs?: number;
	sendDisabled?: boolean;
	sendTooltipText?: string;
	onFileClick?: (audio: AudioHistoryItem) => void;
	onTimeChange?: (time: number) => void;
	onReset?: () => void;
	onSend?: (buffer: ArrayBuffer, transcribe?: boolean) => void;
}

const formatTime = (ms: number): string => {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const Visualizer = (props: VisualizerProps) => {
	const {
		startTime = 0,
		maxDurationMs = 300000,
		sendDisabled = false,
		sendTooltipText,
		onFileClick,
		onTimeChange,
		onReset,
		onSend,
	} = props;

	const { micState, recorderState, recorderActions, micActions } = AudioRecorderService.value;
	const {
		startRecording: startMicrophoneRecording,
		stopRecording: stopMicrophoneRecording,
		toggleMicrophone,
	} = micActions;
	const {
		clearRecording,
		startRecording: startRecorderRecording,
		stopRecording: stopRecorderRecording,
		toggleRecording,
	} = recorderActions;

	const audioContextRef = useRef<AudioContext>(null);
	const analyserRef = useRef<AnalyserNode>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode>(null);

	const [audioHistory, setAudioHistory] = useState<number[]>([]);
	const [limitReached, setLimitReached] = useState(false);
	const [accumulatedTimeMs, setAccumulatedTimeMs] = useState(startTime);
	const [sessionStartTime, setSessionStartTime] = useState<number>(null);

	const historyIntervalRef = useRef<NodeJS.Timeout>(null);
	const accumulatedTimeMsRef = useRef(0);

	useWatch(() => {
		accumulatedTimeMsRef.current = accumulatedTimeMs;
	}, [accumulatedTimeMs]);

	const getCurrentAudioLevel = useCallback((): number => {
		if (!analyserRef.current) return 8;

		const bufferLength = analyserRef.current.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);
		analyserRef.current.getByteFrequencyData(dataArray);

		const lowFreq = dataArray.slice(0, 4).reduce((sum, val) => sum + val, 0) / 4;
		const midFreq = dataArray.slice(4, 12).reduce((sum, val) => sum + val, 0) / 8;
		const highFreq = dataArray.slice(12, 20).reduce((sum, val) => sum + val, 0) / 8;

		const weighted = lowFreq * 0.3 + midFreq * 0.5 + highFreq * 0.2;

		const normalized = (weighted / 255) * 24 + 8;
		return Math.max(8, Math.min(32, normalized));
	}, []);

	const handlePause = useCallback(() => {
		toggleMicrophone();
		toggleRecording();

		if (sessionStartTime) {
			const currentSessionTime = Date.now() - sessionStartTime;
			const totalTimeAtPause = accumulatedTimeMs + currentSessionTime;
			setAccumulatedTimeMs(totalTimeAtPause);
		}

		if (historyIntervalRef.current) {
			clearInterval(historyIntervalRef.current);
			historyIntervalRef.current = null;
		}

		if (sourceRef.current) {
			sourceRef.current.disconnect();
			sourceRef.current = null;
		}

		if (audioContextRef.current && audioContextRef.current.state !== "closed") {
			void audioContextRef.current.close();
			audioContextRef.current = null;
		}

		analyserRef.current = null;
	}, [accumulatedTimeMs, sessionStartTime, toggleMicrophone, toggleRecording]);

	const handleReset = useCallback(() => {
		if (isActive(recorderState)) {
			void stopRecorderRecording();
			stopMicrophoneRecording();
		}

		onReset?.();
		setAudioHistory([]);
		setLimitReached(false);
		setAccumulatedTimeMs(0);
		setSessionStartTime(null);
	}, [onReset, recorderState, stopMicrophoneRecording, stopRecorderRecording]);

	useEffect(() => {
		if (!isActive(recorderState)) handleReset();
	}, [recorderState, handleReset]);

	const startRecordingVisualization = useCallback(() => {
		if (!micState.stream) return;

		try {
			const AudioContextConstructor =
				window.AudioContext ??
				(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AudioContextConstructor) return;

			audioContextRef.current = new AudioContextConstructor();
			const audioContext = audioContextRef.current;

			analyserRef.current = audioContext.createAnalyser();
			const analyser = analyserRef.current;
			analyser.fftSize = 64;
			analyser.smoothingTimeConstant = 0.1;
			analyser.minDecibels = -90;
			analyser.maxDecibels = -10;

			sourceRef.current = audioContext.createMediaStreamSource(micState.stream);
			sourceRef.current.connect(analyser);

			if (accumulatedTimeMsRef.current === 0) setAudioHistory([]);

			historyIntervalRef.current = setInterval(() => {
				const level = getCurrentAudioLevel();
				setAudioHistory((prev) => {
					const newHistory = [...prev, level];
					const limitedHistory = newHistory.length > 200 ? newHistory.slice(-200) : newHistory;

					return limitedHistory;
				});
			}, 50);

			const sessionStart = Date.now();
			setSessionStartTime(sessionStart);
		} catch (error) {
			console.error("Error starting recording visualization:", error);
		}
	}, [getCurrentAudioLevel, micState.stream]);

	const handlePlay = useCallback(async () => {
		if (isPaused(recorderState)) {
			toggleMicrophone();
			toggleRecording();
			startRecordingVisualization();
		} else {
			setAccumulatedTimeMs(0);
			setSessionStartTime(null);
			const stream = await startMicrophoneRecording();
			if (stream) startRecorderRecording(stream);
		}
	}, [
		recorderState,
		startMicrophoneRecording,
		startRecorderRecording,
		startRecordingVisualization,
		toggleMicrophone,
		toggleRecording,
	]);

	const stopRecordingVisualization = useCallback(() => {
		if (historyIntervalRef.current) {
			clearInterval(historyIntervalRef.current);
			historyIntervalRef.current = null;
		}

		if (sourceRef.current) {
			sourceRef.current.disconnect();
			sourceRef.current = null;
		}

		if (audioContextRef.current && audioContextRef.current.state !== "closed") {
			void audioContextRef.current.close();
			audioContextRef.current = null;
		}

		analyserRef.current = null;
	}, []);

	useEffect(() => {
		if (micState.stream && isActive(recorderState) && !isPaused(recorderState)) startRecordingVisualization();
		else if (!isActive(recorderState) && !isPaused(recorderState)) stopRecordingVisualization();

		return () => stopRecordingVisualization();
	}, [micState.stream, recorderState, startRecordingVisualization, stopRecordingVisualization]);

	useEffect(() => {
		const documentVisibilityChange = () => {
			if (document.visibilityState === "hidden") handlePause();
			else if (document.visibilityState === "visible") void handlePlay();
		};

		document.addEventListener("visibilitychange", documentVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", documentVisibilityChange);
		};
	}, [handlePause, handlePlay]);

	const renderVisualization = () => {
		let currentTime = accumulatedTimeMs;

		if (isActive(recorderState) && !isPaused(recorderState) && sessionStartTime) {
			const currentSessionTime = Date.now() - sessionStartTime;
			currentTime += currentSessionTime;
		}

		const isLive = isActive(recorderState) && !isPaused(recorderState);
		const waveSpeed = isLive || currentTime > 0 ? 0.25 : 0.5;

		return (
			<CanvasVisualizator
				audioHistory={audioHistory}
				isPaused={isPaused(recorderState)}
				isRecording={isActive(recorderState)}
				waveSpeed={waveSpeed}
			/>
		);
	};

	const getTooglerIcon = () => {
		if (isPaused(recorderState)) return "play";
		return "pause";
	};

	const getTogglerTooltipText = () => {
		if (limitReached) return t("ai.transcribe.limit-reached");
		if (isActive(recorderState) && !isPaused(recorderState)) return t("ai.transcribe.pause");
		return null;
	};

	const onSendClick = async () => {
		if (isActive(recorderState)) {
			const result = await stopRecorderRecording();
			if (result) onSend?.(result.buffer);

			clearRecording();
			stopMicrophoneRecording();
		}
	};

	const handleTimeClick = useCallback(
		(time: number) => {
			if (time >= maxDurationMs) {
				setLimitReached(true);
				handlePause();
			}

			onTimeChange?.(time);
		},
		[maxDurationMs, handlePause, onTimeChange],
	);

	return (
		<div className="flex w-full items-center justify-between gap-[0.5em]">
			<AudioHistory disabled={sendDisabled} onClick={onFileClick} />
			<GlassToolbarToggleButton
				disabled={limitReached}
				onClick={isActive(recorderState) && !isPaused(recorderState) ? handlePause : handlePlay}
				tooltipText={getTogglerTooltipText()}
			>
				<GlassToolbarIcon icon={getTooglerIcon()} />
			</GlassToolbarToggleButton>
			<div className="h-[1em] w-full">{renderVisualization()}</div>
			<div className="flex items-center gap-2">
				<Timer
					accumulatedTimeMs={accumulatedTimeMs}
					formatTime={formatTime}
					maxDurationMs={maxDurationMs}
					onTimeChange={handleTimeClick}
					paused={isPaused(recorderState)}
				/>
				<AiToolbarButton
					disabled={sendDisabled}
					icon="check"
					onClick={onSendClick}
					tooltipText={sendTooltipText}
				/>
			</div>
		</div>
	);
};

export default Visualizer;
