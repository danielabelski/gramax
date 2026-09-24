import { ModulithService } from "./ModulithService";

describe("ModulithService search health", () => {
	it("reports no data when there is no active workspace", () => {
		const service = new ModulithService({
			wm: {
				maybeCurrent: () => undefined,
				current: () => {
					throw new Error("NoActiveWorkspace");
				},
			} as never,
		} as never);

		expect(service.getSearchHealth()).toEqual({ phase: "no-data" });
	});
});
