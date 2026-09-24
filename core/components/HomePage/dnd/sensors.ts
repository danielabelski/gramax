import { defaultDropAnimationSideEffects, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export const useHomeDndSensors = () =>
	useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

export const cardDropAnimation = {
	sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};
