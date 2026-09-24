import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { Level } from "@ext/settings/logic/settings";
import { openAgentSecretsSettings } from "./openAgentSecretsSettings";

jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	// biome-ignore lint/style/useNamingConvention: expected
	__esModule: true,
	default: { setValue: jest.fn(), resetValue: jest.fn() },
}));

describe("openAgentSecretsSettings", () => {
	beforeEach(() => {
		(ModalToOpenService.setValue as jest.Mock).mockClear();
	});

	test("opens the app settings modal on the keys-and-passwords tab", () => {
		openAgentSecretsSettings();

		expect(ModalToOpenService.setValue).toHaveBeenCalledWith(
			ModalToOpen.AppSettings,
			expect.objectContaining({ defaultLevel: Level.app, defaultAppTab: "keys-passwords" }),
		);
	});

	test("opens the cloud settings modal on the same tab when running in the cloud", () => {
		openAgentSecretsSettings(true);

		expect(ModalToOpenService.setValue).toHaveBeenCalledWith(
			ModalToOpen.GesAppSettings,
			expect.objectContaining({ defaultLevel: Level.app, defaultAppTab: "keys-passwords" }),
		);
	});
});
