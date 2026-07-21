<script>
	import { onMount } from 'svelte';

	// Fills the deck stage in place of a slide image. Autoplays on mount and,
	// unless `loop`, calls `onended` when finished so the deck can advance.
	let { src, loop = false, muted = false, onended = () => {} } = $props();

	let el; // the <video> element
	let needsTap = $state(false); // autoplay was blocked — show a tap-to-play hint

	onMount(() => {
		// Entering the slide is usually a user gesture, so playback is allowed;
		// if the browser still blocks it (muted-autoplay policy), surface a hint
		// instead of silently sitting on a black frame.
		el?.play?.().catch(() => {
			needsTap = true;
		});
	});

	function handleEnded() {
		if (!loop) onended();
	}

	function tapToPlay(e) {
		e.stopPropagation(); // don't let the deck treat this as a navigate click
		needsTap = false;
		el?.play?.().catch(() => {});
	}
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video
	bind:this={el}
	class="slide-video"
	{src}
	{loop}
	{muted}
	autoplay
	playsinline
	preload="auto"
	onended={handleEnded}
></video>

{#if needsTap}
	<button class="tap" onclick={tapToPlay}>▶ Tap to play</button>
{/if}

<style>
	.slide-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		background: #000;
	}
	.tap {
		position: absolute;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0.75rem 1.5rem;
		border: 0;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font:
			600 1.1rem system-ui,
			sans-serif;
		cursor: pointer;
	}
</style>
