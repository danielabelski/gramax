import { $ } from "bun";
import { createHash } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Builder } from "./builder";

// tauri-bundler fetches this plugin from the fork's master unless it is already in `dirs::cache_dir()/tauri`.
// master's upstream sync (tauri-apps/linuxdeploy-plugin-gtk#5, 2026-09-20) breaks AppImage bundling; drop after tauri#16062.
const GTK_PLUGIN_REV = "b5eb8d05b4c0ed40107fe2158c5d8527f94568ef";
const GTK_PLUGIN_SHA256 = "cb379f9b0733e9ad9f8bd78f8c2fa038aef2478523bb7d4c8e64ff6a1ea3501a";

export class LinuxBuilder extends Builder {
	override get isSigningSupported(): boolean {
		return false;
	}

	override get platform(): string {
		return "linux-x86_64";
	}

	override get humanPlatform(): string {
		return "linux";
	}

	override get target(): string {
		return "x86_64-unknown-linux-gnu";
	}

	override async _build(): Promise<void> {
		const target = this.target;
		const config = this._createTauriConfig();
		const profile = this.profile;

		await this._pinGtkPlugin();

		await $`cargo tauri build --ci --target ${target} -c ${config} -- --profile ${profile}`
			.cwd("apps/tauri")
			.throws(true);
	}

	private async _pinGtkPlugin(): Promise<void> {
		const cacheDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
		const dest = path.join(cacheDir, "tauri", "linuxdeploy-plugin-gtk.sh");
		const url = `https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/${GTK_PLUGIN_REV}/linuxdeploy-plugin-gtk.sh`;

		const res = await fetch(url);
		if (!res.ok) throw new Error(`failed to download ${url}: ${res.status}`);
		const data = Buffer.from(await res.arrayBuffer());

		const sha256 = createHash("sha256").update(data).digest("hex");
		if (sha256 !== GTK_PLUGIN_SHA256) throw new Error(`${url}: sha256 mismatch, got ${sha256}`);

		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, data);
		await fs.chmod(dest, 0o755);
		console.log(`pinned linuxdeploy-plugin-gtk.sh@${GTK_PLUGIN_REV.slice(0, 10)} -> ${dest}`);
	}

	override async _package(): Promise<void> {
		const appimage = path.join(this.targetDir, "bundle/appimage");
		const deb = path.join(this.targetDir, "bundle/deb");
		const rpm = path.join(this.targetDir, "bundle/rpm");

		await this._artifact({
			name: `gramax.${this.platform}.appimage`,
			srcdir: appimage,
			filename: `${this.opts.productName}_${this.opts.version}_amd64.AppImage`,
		});

		await this._artifact({
			name: `gramax.${this.platform}.appimage.sig`,
			srcdir: appimage,
			filename: `${this.opts.productName}_${this.opts.version}_amd64.AppImage.sig`,
		});

		await this._artifact({
			name: `gramax.${this.platform}.deb`,
			srcdir: deb,
			filename: `${this.opts.productName}_${this.opts.version}_amd64.deb`,
		});

		await this._artifact({
			name: `gramax.${this.platform}.deb.sig`,
			srcdir: deb,
			filename: `${this.opts.productName}_${this.opts.version}_amd64.deb.sig`,
		});

		await this._artifact({
			name: `gramax.${this.platform}.rpm`,
			srcdir: rpm,
			filename: `${this.opts.productName}-${this.opts.version}-1.x86_64.rpm`,
		});

		await this._artifact({
			name: `gramax.${this.platform}.rpm.sig`,
			srcdir: rpm,
			filename: `${this.opts.productName}-${this.opts.version}-1.x86_64.rpm.sig`,
		});
	}

	override async _sign(): Promise<void> {}

	override async _verify(): Promise<void> {}
}
