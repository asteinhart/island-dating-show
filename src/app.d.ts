// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** Anonymous per-browser voter id, set by hooks.server.js. */
			voterId: string;
		}
	}
}

export {};
