import { confirmLeaveEditMode } from "./confirmations";
import { useHomepageLayoutStore } from "./store/homepageLayoutStore";

export const leaveEditModeGuard = async () => {
	const { editScope, cancelEdit } = useHomepageLayoutStore.getState();
	if (editScope === null) return true;
	if (!(await confirmLeaveEditMode())) return false;
	cancelEdit();
	return true;
};
