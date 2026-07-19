<script>
	import { onMount } from 'svelte';
	import Vote from '$lib/Vote.svelte';
	import { sceneById } from '$lib/voterScenes';

	const POLL_MS = 1500;

	let sceneId = $state('idle');
	let ready = $state(false); // has the first poll landed?

	// Resolve the current scene id to what we should render.
	let scene = $derived(sceneById(sceneId));

	async function poll() {
		try {
			const res = await fetch('/api/state');
			if (res.ok) {
				const data = await res.json();
				sceneId = data.state ?? 'idle';
			}
		} catch {
			// keep showing the last scene on a transient network blip
		} finally {
			ready = true;
		}
	}

	onMount(() => {
		poll();
		const timer = setInterval(poll, POLL_MS);
		return () => clearInterval(timer);
	});
</script>

<main>
	{#if !ready}
		<p class="waiting">Connecting…</p>
	{:else if scene.kind === 'vote'}
		<!-- `voteId` in the key resets the component when the poll changes, so a new
		     vote starts fresh rather than reusing the previous poll's state. -->
		{#key scene.voteId}
			{#if scene.title}<h1>{scene.title}</h1>{/if}
			<Vote voteId={scene.voteId} options={scene.options} showResults={scene.showResults ?? true} />
		{/key}
	{:else}
		<div class="idle">
			<div class="dancing-script-medium">Sit tight</div>
			<p>The next vote will appear here.</p>
		</div>
	{/if}
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
		background: linear-gradient(#ff40b5, #ffde59);
	}
	h1 {
		margin: 0;
		text-align: center;
		color: white;
	}
	.waiting {
		color: rgba(0, 0, 0, 0.6);
	}
	.idle {
		text-align: center;
		color: white;
	}
	.idle .dancing-script-medium {
		font-size: 2.5rem;
		line-height: 1.1;
	}
	.idle p {
		margin: 0.5rem 0 0;
		opacity: 0.9;
	}
</style>
