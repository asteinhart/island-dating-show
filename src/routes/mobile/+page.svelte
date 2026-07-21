<script>
	import { onMount } from 'svelte';
	import Vote from '$lib/Vote.svelte';
	import { getSlideConfig, voteOptionsForSlide } from '$lib/slideConfig';

	const POLL_MS = 1500;

	// The deck writes the current slide's id to presentation_state.slide_id; we
	// poll it and let slideConfig decide what this phone should show.
	let slideId = $state(null);
	let ready = $state(false); // has the first poll landed?

	let cfg = $derived(getSlideConfig(slideId));
	let options = $derived(voteOptionsForSlide(slideId));

	async function poll() {
		try {
			const res = await fetch('/api/state');
			if (res.ok) {
				const data = await res.json();
				slideId = data.slideId ?? null;
			}
		} catch {
			// keep showing the last screen on a transient network blip
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
	{:else if cfg?.vote}
		<!-- Keying on slideId resets the vote UI when the deck moves to a new poll,
		     so each vote starts fresh rather than reusing the previous state. -->
		{#key slideId}
			{#if cfg.mobile?.title}<h1>{cfg.mobile.title}</h1>{/if}
			{#if cfg.mobile?.text}<p class="prompt">{cfg.mobile.text}</p>{/if}
			<Vote voteId={slideId} {options} />
		{/key}
	{:else if cfg?.mobile}
		<!-- Info screen: welcome / get-ready / thanks / etc. -->
		<div class="info">
			<div class="dancing-script-medium">{cfg.mobile.title}</div>
			{#if cfg.mobile.text}<p>{cfg.mobile.text}</p>{/if}
		</div>
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
	.prompt {
		margin: 0;
		text-align: center;
		color: white;
		opacity: 0.9;
		max-width: 30ch;
	}
	.waiting {
		color: rgba(0, 0, 0, 0.6);
	}
	.info,
	.idle {
		text-align: center;
		color: white;
	}
	.info .dancing-script-medium,
	.idle .dancing-script-medium {
		font-size: 2.5rem;
		line-height: 1.1;
	}
	.info p,
	.idle p {
		margin: 0.5rem 0 0;
		opacity: 0.9;
	}
</style>
