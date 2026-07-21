import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-auto detects Vercel automatically and uses adapter-vercel there.
		adapter: adapter()
	}
};
