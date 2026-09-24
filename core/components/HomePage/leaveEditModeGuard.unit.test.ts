/**
 * @jest-environment node
 */
import { confirmLeaveEditMode } from "./confirmations";
import { leaveEditModeGuard } from "./leaveEditModeGuard";
import { useHomepageLayoutStore } from "./store/homepageLayoutStore";

jest.mock("./confirmations", () => ({ confirmLeaveEditMode: jest.fn() }));

const confirmMock = confirmLeaveEditMode as jest.MockedFunction<typeof confirmLeaveEditMode>;

describe("leaveEditModeGuard", () => {
	beforeEach(() => {
		confirmMock.mockReset();
		useHomepageLayoutStore.setState({ editScope: null });
	});

	test("passes through without asking when not editing", async () => {
		await expect(leaveEditModeGuard()).resolves.toBe(true);
		expect(confirmMock).not.toHaveBeenCalled();
	});

	test("blocks and stays in edit mode when the user declines", async () => {
		useHomepageLayoutStore.getState().beginEdit("personal");
		confirmMock.mockResolvedValue(false);

		await expect(leaveEditModeGuard()).resolves.toBe(false);
		expect(useHomepageLayoutStore.getState().editScope).toBe("personal");
	});

	test("leaves edit mode when the user confirms", async () => {
		useHomepageLayoutStore.getState().beginEdit("personal");
		confirmMock.mockResolvedValue(true);

		await expect(leaveEditModeGuard()).resolves.toBe(true);
		expect(useHomepageLayoutStore.getState().editScope).toBeNull();
	});
});
