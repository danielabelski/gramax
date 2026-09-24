import type { ArticleProviderType } from "@ext/articleProvider/logic/ArticleProvider";
import { create } from "zustand";

export type ResourceData = Record<string, Buffer>;

export interface ResourceStoreState {
	data: ResourceData;
	fingerprints: Record<string, string>;
	cacheVersion: number;
	resourceVersions: Record<string, number>;
	id?: string;
	provider?: ArticleProviderType;
	update: (src: string, buffer: Buffer) => void;
	get: (src: string) => Buffer | undefined;
	clear: () => void;
	remove: (src: string) => void;
	reset: (newId?: string, newProvider?: ArticleProviderType) => void;
}

interface ResourceStoreProps {
	id?: string;
	provider?: ArticleProviderType;
}

const getBufferFingerprint = (buffer: Buffer): string => {
	let first = 0x811c9dc5;
	let second = 0x9e3779b9;
	for (const byte of buffer) {
		first = Math.imul(first ^ byte, 0x01000193);
		second = Math.imul(second ^ byte, 0x5bd1e995);
	}
	return `${buffer.length}:${first >>> 0}:${second >>> 0}`;
};

export const createResourceStore = ({ id, provider }: ResourceStoreProps) =>
	create<ResourceStoreState>((set, get) => ({
		id,
		provider,

		data: {},
		fingerprints: {},
		cacheVersion: 0,
		resourceVersions: {},

		update: (src: string, buffer: Buffer) => {
			set((state) => {
				const fingerprint = getBufferFingerprint(buffer);
				if (state.data[src] && state.fingerprints[src] === fingerprint) return state;
				const contentChanged = state.fingerprints[src] !== fingerprint;

				return {
					data: { ...state.data, [src]: buffer },
					fingerprints: contentChanged ? { ...state.fingerprints, [src]: fingerprint } : state.fingerprints,
					resourceVersions: contentChanged
						? { ...state.resourceVersions, [src]: (state.resourceVersions[src] ?? 0) + 1 }
						: state.resourceVersions,
				};
			});
		},

		get: (src: string) => {
			return get().data[src];
		},

		clear: () => {
			set((state) => ({
				data: {},
				cacheVersion: state.cacheVersion + 1,
			}));
		},

		remove: (src: string) => {
			set((state) => {
				const { [src]: _, ...data } = state.data;
				const { [src]: __, ...fingerprints } = state.fingerprints;
				return {
					data,
					fingerprints,
					resourceVersions: {
						...state.resourceVersions,
						[src]: (state.resourceVersions[src] ?? 0) + 1,
					},
				};
			});
		},

		reset: (newId?: string, newProvider?: ArticleProviderType) => {
			set((state) => ({
				data: {},
				fingerprints: {},
				cacheVersion: state.cacheVersion + 1,
				resourceVersions: {},
				id: newId,
				provider: newProvider,
			}));
		},
	}));
