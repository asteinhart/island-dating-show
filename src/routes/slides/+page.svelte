<script>
	import { onMount } from 'svelte';
	import manifest from '$lib/assets/manifest.json';
	import {
		getSlideConfig,
		resultsGroupByPrimary,
		isCollapsedGroupMember,
		videoSlides
	} from '$lib/slideConfig';
	import Video from '$lib/Video.svelte';
	import Results from '$lib/Results.svelte';
	import Outcome from '$lib/Outcome.svelte';
	import Prevote from '$lib/Prevote.svelte';
	import Countdown from '$lib/Countdown.svelte';
	import Selfie from '$lib/Selfie.svelte';
	import Composite from '$lib/Composite.svelte';

	// Index the resolved URLs by filename so we can look them up from the manifest.
	const urlByName = {};
	for (const [path, url] of Object.entries(
		manifest.slides.reduce((acc, s) => ({ ...acc, [s.src.split('/').pop()]: s.src }), {})
	)) {
		urlByName[path.split('/').pop()] = url;
	}

	// Build the ordered slide list from the manifest, swapping each relative
	// `src` for its resolved URL. Drop any entry whose image is missing.
	const allSlides = manifest.slides
		.map((s) => ({ ...s, src: urlByName[s.src.split('/').pop()] }))
		.filter((s) => s.src); // [{ src, w, h, id }]

	// id -> resolved image URL, so <Results> can reveal any winner's pre-made slide.
	const srcById = Object.fromEntries(allSlides.map((s) => [s.id, s.src]));

	// id -> video src, so a video reveal group can play any outcome's clip. Built
	// from the config (not the manifest) since videos live in static/, not the deck.
	const videoSrcById = Object.fromEntries(videoSlides.map((v) => [v.id, v.src]));

	// Collapse winner-reveal groups: keep only each group's primary slide in the
	// deck; its <Results> component reveals the right member image from the vote.
	const slides = allSlides.filter((s) => !isCollapsedGroupMember(s.id));

	let current = $state(null);
	$inspect('current', current);

	// On (re)load, resume from the slide saved in the database instead of resetting
	// to the intro. Until this finishes, the sync effect below holds off posting so
	// it can't clobber the saved slide with the reset value.
	let restored = $state(false);
	onMount(async () => {
		try {
			const res = await fetch('/api/state');
			const { slideId } = await res.json();

			const idx = slides.findIndex((s) => s.id === slideId);
			if (idx !== -1) current = idx + 1;
		} catch {
			// no saved state (or fetch failed) -> stay on the intro slide
		} finally {
			restored = true;
		}
	});
	let loadError = $state(slides.length ? '' : 'No slides found.');
	let slideId = $derived(slides[current - 1]?.id ?? null);

	// Total number of slides in the deck (1-based: current 1..total).
	let total = slides.length;

	// The current slide (1-based: current 1 -> slides[0]) and its config role.
	let slide = $derived(slides[current - 1]);
	let cfg = $derived(slide ? getSlideConfig(slide.id) : null);
	// If this slide is a winner-reveal group's primary, drive it live with <Results>.
	let group = $derived(slide ? resultsGroupByPrimary(slide.id) : null);

	function next() {
		if (current < total) current += 1;
	}
	function prev() {
		if (current > 1) current -= 1;
	}

	function onKey(e) {
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
			case ' ':
				e.preventDefault();
				next();
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				e.preventDefault();
				prev();
				break;
			case 'Home':
				e.preventDefault();
				current = 1;
				break;
			case 'End':
				e.preventDefault();
				current = total;
				break;
			case 'f':
				toggleFullscreen();
				break;
			case '1':
				e.preventDefault();
				current = 1;
				break;
		}
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else document.documentElement.requestFullscreen();
	}

	function onClick(e) {
		// Click right half = next, left half = previous.
		if (e.clientX > window.innerWidth / 2) next();
		else prev();
	}

	// Tell the voters' phones which scene to show for the current slide. Each slide
	// maps to its manifest id via SLIDE_SCENE. Runs client-side only, once per slide
	// change.
	$effect(() => {
		// Publish the current slide's manifest id so phones switch to its scene.
		const slideId = slides[current - 1]?.id ?? null;
		// Hold off until the initial restore has read the saved slide, so we don't
		// overwrite it with the reset value on load.
		// if (!restored) return;
		// const state = 'none';
		// fetch('/api/state', {
		// 	method: 'POST',
		// 	headers: { 'content-type': 'application/json' },
		// 	body: JSON.stringify({ state, slideId })
		// }).catch(() => {}); // a dropped sync just means voters update on the next change
		// //console.log(`Slide ${current} (${slideId ?? 'welcome'}) -> scene "${state}"`); // eslint-disable-line no-console
	});

	// Preload the neighbouring PDF slide so advancing feels instant.
	$effect(() => {
		for (const offset of [1, 2]) {
			const idx = current - 1 + offset; // slide index into `slides`
			if (idx >= 0 && idx < slides.length) {
				const img = new Image();
				img.src = slides[idx].src;
			}
		}
	});
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="deck"
	role="button"
	tabindex="0"
	aria-label="Slideshow. Use arrow keys or click to navigate."
	onclick={onClick}
>
	<div class="stage">
		{#if !current}
			<div class="loading"></div>
		{:else if slide.id === 'pre-show-vote'}
			<Prevote />
		{:else if slide.id === 'video-timer'}
			<Countdown value={5} />
		{:else if slide.id === 'title-final'}
			<!-- Final slide: the title card as a backdrop, with every character and
			     each audience selfie (today's int-imgs/ uploads) scattered as hearts. -->
			<Composite bg={slide.src} />
		{:else if group}
			<!-- Outcome reveal: poll the vote, then reveal the chosen couple's pre-made
			     image, or play their pre-made clip and advance when it ends. Checked
			     before cfg.video so a video group's primary reveals live instead of
			     playing its own single take. -->
			{#key slide.id}
				{#if group.kind === 'video'}
					<Outcome
						voteId={group.voteId ?? null}
						rankBy={group.rankBy ?? null}
						choiceToId={group.choiceToId}
						srcById={videoSrcById}
						kind="video"
						select={group.select ?? 'winner'}
						fallback={group.fallback ?? null}
						onended={next}
					/>
				{:else}
					<Outcome
						voteId={group.voteId ?? null}
						rankBy={group.rankBy ?? null}
						choiceToId={group.choiceToId}
						{srcById}
						select={group.select ?? 'winner'}
					/>
				{/if}
			{/key}
		{:else if cfg?.video}
			<!-- Video slide: advance to the next slide when the clip ends (unless it loops). -->
			{#key slide.id}
				<Video src={cfg.video.src} loop={cfg.video.loop} onended={next} />
			{/key}
		{:else if cfg?.results}
			<!-- Live ranking: poll the vote tally and rank the entries. -->
			{#key slide.id}
				<Results {...cfg.results} />
			{/key}
		{:else}
			<img
				id={slide.id}
				class="slide-img"
				src={slide.src}
				width={slide.w}
				height={slide.h}
				alt={slide.id ?? `Slide ${current}`}
				draggable="false"
			/>
		{/if}
	</div>

	<div class="counter">{current} / {total} {slideId}</div>
</div>

<style>
	.deck {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
		overflow: hidden;
		cursor: pointer;
		user-select: none;
	}

	/* Fixed 16:9 stage (1440x809), scaled to fit the viewport. */
	.stage {
		position: relative;
		aspect-ratio: 1440 / 809;
		width: min(100vw, 100vh * 1440 / 809);
		overflow: hidden;
		container-type: size;
	}

	.loading {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 7cqw;
		line-height: 1.2;
		color: white;
		background: linear-gradient(#ff40b5, #ffde59);
	}

	.slide-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.counter {
		position: absolute;
		bottom: 1rem;
		right: 1.25rem;
		font-size: 0.9rem;
		font-family: system-ui, sans-serif;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.35);
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		pointer-events: none;
	}
</style>
