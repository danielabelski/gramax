export enum UpdateAcceptance {
	None,
	Accepted,
	Declined,
}

export type UpdateEvent = { type: "update:reset" } | { type: "update:set-accept"; payload: UpdateAcceptance };

const CHANNEL_NAME = "update-events";

export const createUpdateEventsChannel = () => new BroadcastChannel(CHANNEL_NAME);
