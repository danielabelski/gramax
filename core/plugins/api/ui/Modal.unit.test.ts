const mockAddModal = jest.fn(() => "modal-1");
const mockRemoveModal = jest.fn();

jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		addModal: mockAddModal,
		removeModal: mockRemoveModal,
	},
}));

import { Modal } from "./Modal";

describe("Modal", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("closes the opened modal", () => {
		const modal = new Modal({ title: "Title" });

		modal.open();
		modal.close();

		expect(mockRemoveModal).toHaveBeenCalledWith("modal-1");
	});

	test("does nothing when the modal is not open", () => {
		const modal = new Modal({ title: "Title" });

		modal.close();

		expect(mockRemoveModal).not.toHaveBeenCalled();
	});
});
