import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { showGesRequiredModal } from "./showGesRequiredModal";

jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	setValue: jest.fn(),
	resetValue: jest.fn(),
}));
jest.mock("@ext/localization/locale/translate", () => (key: string) => key);

it("открывает информационную модалку с одной кнопкой закрытия", () => {
	showGesRequiredModal();
	const [modal, props] = (ModalToOpenService.setValue as jest.Mock).mock.calls[0];
	expect(modal).toBe(ModalToOpen.AlertConfirm);
	expect(props.title).toBe("enterprise-catalog-required-title");
	expect(props.cancelText).toBe("ok");
	expect(props.onConfirm).toBeUndefined();
	props.onCancel();
	expect(ModalToOpenService.resetValue).toHaveBeenCalledTimes(1);
});
