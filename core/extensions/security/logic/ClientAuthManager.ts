import AuthManager from "@ext/security/logic/AuthManager";
import localUser from "@ext/security/logic/User/localUser";
import type User from "../../security/logic/User/User";

export default class ClientAuthManager extends AuthManager {
	async login() {}
	async logout() {}
	async assert() {}
	async mailSendOTP() {}
	async mailLoginOTP() {}
	async getUser(): Promise<User> {
		return localUser;
	}
}
