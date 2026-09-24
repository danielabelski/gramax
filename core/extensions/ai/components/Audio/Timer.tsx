import { GlassToolbarText } from "@ui-kit/GlassToolbar";
import { useEffect, useState } from "react";

interface TimerProps {
	maxDurationMs: number;
	paused: boolean;
	accumulatedTimeMs: number;
	formatTime: (ms: number) => string;
	onTimeChange?: (time: number) => void;
}

const Timer = ({ formatTime, maxDurationMs, accumulatedTimeMs, paused, onTimeChange }: TimerProps) => {
	const [currentTime, setCurrentTime] = useState(accumulatedTimeMs);

	useEffect(() => {
		if (paused) return;
		const interval = setInterval(() => {
			const newTime = currentTime + 100;
			setCurrentTime(newTime);
			onTimeChange?.(newTime);
		}, 100);
		return () => clearInterval(interval);
	}, [currentTime, paused, onTimeChange]);

	return (
		<GlassToolbarText className="whitespace-nowrap font-medium text-xs">
			{formatTime(currentTime)} / {formatTime(maxDurationMs)}
		</GlassToolbarText>
	);
};

export default Timer;
