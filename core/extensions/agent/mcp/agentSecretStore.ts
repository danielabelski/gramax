import type { AppConfig } from "@app/config/AppConfig";
import resolveModule from "@app/resolveModule/backend";
import type Cookie from "@ext/cookie/Cookie";

const SECRETS_KEY = "agent_secrets";

export type AgentSecret = {
	type: "token" | "login";
	login?: string;
	password?: string;
	token?: string;
	url?: string;
};

export class AgentSecretStore {
	private _secrets: Record<string, AgentSecret> = {};
	private readonly _storage: Cookie;

	constructor(config: AppConfig) {
		const ResolveCookie = resolveModule("Cookie");
		this._storage = new ResolveCookie(config.tokens.cookie, null, null);
	}

	async load(): Promise<void> {
		try {
			const data = this._storage.get(SECRETS_KEY);
			this._secrets = data ? JSON.parse(data) : {};
		} catch {
			this._secrets = {};
		}
	}

	list(includeValues = false): Record<string, AgentSecret> {
		if (includeValues) return this._secrets;
		return Object.fromEntries(Object.entries(this._secrets).map(([key, secret]) => [key, { type: secret.type }]));
	}

	refs(includeValues = false, includeUrl = true): Record<string, string | undefined> {
		const out: Record<string, string | undefined> = {};
		for (const [name, secret] of Object.entries(this._secrets)) {
			if (secret.login !== undefined) out[`${name}.login`] = includeValues ? secret.login : undefined;
			if (secret.password !== undefined) out[`${name}.password`] = includeValues ? secret.password : undefined;
			if (secret.token !== undefined) out[`${name}.token`] = includeValues ? secret.token : undefined;
			if (includeUrl && secret.url !== undefined) out[`${name}.url`] = includeValues ? secret.url : undefined;
		}
		return out;
	}

	get(key: string): AgentSecret | undefined {
		return this._secrets[key];
	}

	resolve(text: string): { text: string; missing: string[] } {
		const refs = this.refs(true);
		const missing = new Set<string>();
		const resolved = text.replace(/\$(\$?)\{([^}]+)\}/g, (match, escape: string, name: string) => {
			if (escape === "$") return `\${${name}}`;
			const value = refs[name];
			if (value === undefined) {
				missing.add(name);
				return match;
			}
			return JSON.stringify(value).slice(1, -1);
		});
		return { text: resolved, missing: [...missing] };
	}

	unresolve(text: string): string {
		let result = text;
		for (const [name, value] of Object.entries(this.refs(true, false)).sort(
			([, a], [, b]) => b.length - a.length,
		)) {
			if (!value) continue;
			result = result.split(JSON.stringify(value).slice(1, -1)).join(`\${${name}}`);
		}
		return result;
	}

	async set(key: string, secret: AgentSecret): Promise<void> {
		this._secrets[key] = secret;
		await this._save();
	}

	async delete(key: string): Promise<void> {
		delete this._secrets[key];
		await this._save();
	}

	async update(oldKey: string, newKey: string, secret: AgentSecret): Promise<void> {
		if (oldKey === newKey) {
			this._secrets[newKey] = secret;
		} else {
			const rebuilt: Record<string, AgentSecret> = {};
			for (const [key, value] of Object.entries(this._secrets)) {
				rebuilt[key === oldKey ? newKey : key] = key === oldKey ? secret : value;
			}
			if (!(oldKey in this._secrets)) rebuilt[newKey] = secret;
			this._secrets = rebuilt;
		}
		await this._save();
	}

	private async _save(): Promise<void> {
		this._storage.set(SECRETS_KEY, JSON.stringify(this._secrets));
	}
}
