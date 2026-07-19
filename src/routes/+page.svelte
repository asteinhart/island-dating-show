<script>
	import manifest from '$lib/assets/slides/manifest.json';

	// Eagerly resolve every slide image to its final built URL, keyed by module path.
	const urls = import.meta.glob('$lib/assets/slides/*.webp', {
		eager: true,
		query: '?url',
		import: 'default'
	});

	// Index the resolved URLs by filename so we can look them up from the manifest.
	const urlByName = {};
	for (const [path, url] of Object.entries(urls)) {
		urlByName[path.split('/').pop()] = url;
	}

	// Build the ordered slide list from the manifest, swapping each relative
	// `src` for its resolved URL. Drop any entry whose image is missing.
	const slides = manifest.slides
		.map((s) => ({ ...s, src: urlByName[s.src.split('/').pop()] }))
		.filter((s) => s.src); // [{ src, w, h, id }]

	let current = $state(0); // 0 = welcome slide, 1..n = PDF pages
	let loadError = $state(slides.length ? '' : 'No slides found.');

	// Total = welcome slide + PDF pages.
	let total = slides.length + 1;

	function next() {
		if (current < total - 1) current += 1;
	}
	function prev() {
		if (current > 0) current -= 1;
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
				current = 0;
				break;
			case 'End':
				e.preventDefault();
				current = total - 1;
				break;
			case 'f':
				toggleFullscreen();
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

<div
	class="deck"
	role="button"
	tabindex="0"
	aria-label="Slideshow. Use arrow keys or click to navigate."
	onclick={onClick}
>
	<div class="stage">
		{#if current === 0}
			<!-- Welcome / title slide -->
			<div class="welcome">
				<div class="dancing-script-medium">Welcome to</div>
				<div class="poppins-bold">Island Dating Show</div>
				{#if loadError}
					<p class="hint">{loadError}</p>
				{/if}
			</div>
		{:else}
			{@const slide = slides[current - 1]}
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

	<div class="counter">{current + 1} / {total}</div>
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

	.welcome {
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

	.hint {
		font-size: 1rem;
		max-width: 40ch;
		margin-top: 2rem;
		font-family: system-ui, sans-serif;
		opacity: 0.85;
	}
</style>
