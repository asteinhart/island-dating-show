<script>
	import { onMount } from 'svelte';
	import Vote from '$lib/Vote.svelte';
	import { getSlideConfig, voteOptionsForSlide } from '$lib/slideConfig';

	const POLL_MS = 1500;

	// The deck writes the current slide's id to presentation_state.slide_id; we
	// poll it and let slideConfig decide what this phone should show.
	let slideId = $state(null);
	let ready = $state(false); // has the first poll landed?
	let lastMobile = $state(null);

	let cfg = $derived(getSlideConfig(slideId));
	let options = $derived(voteOptionsForSlide(slideId));

	$effect(() => {
		if (cfg?.mobile) {
			lastMobile = cfg.mobile;
		}
	});

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
		<div></div>
	{:else if cfg?.vote}
		<!-- Keying on slideId resets the vote UI when the deck moves to a new poll,
		     so each vote starts fresh rather than reusing the previous state. -->
		{#key slideId}
			{#if cfg.mobile?.text}<h3 class="prompt">{@html cfg.mobile.text}</h3>{/if}
			<Vote voteId={slideId} {options} />
		{/key}
	{:else if cfg?.mobile}
		<!-- Info screen: welcome / get-ready / thanks / etc. -->
		{#if cfg.mobile.id === 'black1'}
			<h2 class="dancing-script-medium">Welcome to</h2>
			<h1 class="poppins-bold">Island Dating Show</h1>
			<br />
			<h3 class="poppins-bold">Voting will begin shortly</h3>
		{:else if cfg.mobile.id === 'get-ready1' || cfg.mobile.id === 'get-ready2'}
			<h2 class="poppins-bold">GET READY <br />TO VOTE!</h2>
			<h2 class="emoji">💖</h2>
		{:else if cfg.mobile.id === 'results-winners-cc'}
			<h3 class="poppins-bold">Thanks for voting!</h3>
			<h3 class="poppins-bold">See you next time!</h3>

			<!-- TODO add image logo here -->
		{:else}
			<div class="main"></div>
		{/if}
	{:else if lastMobile}
		<!-- Hold the last mobile screen until the deck publishes a new mobile payload. -->
		{#if lastMobile.id === 'black1'}
			<h2 class="dancing-script-medium">Welcome to</h2>
			<h1 class="poppins-bold">Island Dating Show</h1>
			<br />
			<h3 class="poppins-bold">Voting will begin shortly</h3>
		{:else if lastMobile.id === 'get-ready1' || lastMobile.id === 'get-ready2'}
			<h2 class="poppins-bold">GET READY <br />TO VOTE!</h2>
			<h2 class="emoji">💖</h2>
		{:else if lastMobile.id === 'results-winners-cc'}
			<h3 class="poppins-bold">Thanks for voting!</h3>
			<h3 class="poppins-bold">💌</h3>

			<!-- TODO add image logo here -->
		{:else}
			<h2 class="poppins-bold">Thanks for voting!</h2>
			<h2 class="emoji">💌</h2>
		{/if}
	{:else}
		<h2 class="dancing-script-medium">Welcome to</h2>
		<h1 class="poppins-bold">Island Dating Show</h1>
		<br />
		<h3 class="poppins-bold">Voting will begin shortly</h3>
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
		color: white;
	}

	h1,
	h2,
	h3 {
		filter: drop-shadow(0 0 0.5rem rgba(0, 0, 0, 0.3));
		line-height: 1.1;
	}

	h1 {
		margin: 0;
		font-size: 5rem;
		text-align: center;
	}

	h2 {
		margin: 0;
		font-size: 4rem;
		text-align: center;
	}

	h3 {
		margin: 0;
		font-size: 2rem;
		text-align: center;
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
		font-size: 5rem;
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
