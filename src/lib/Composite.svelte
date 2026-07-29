<script>
	import { onMount } from 'svelte';

	// The current title-final slide image, passed from the deck as the backdrop
	// we scatter the hearts over.
	let { bg = '' } = $props();

	// Every character portrait, bundled at build time -> array of resolved URLs.
	const characterUrls = Object.values(
		import.meta.glob('./assets/characters/*.webp', {
			eager: true,
			query: '?url',
			import: 'default'
		})
	);

	// Each heart carries its own random placement, computed once when it's added,
	// so the characters don't jump around when the selfies finish loading.
	let hearts = $state([]);

	const rand = (min, max) => min + Math.random() * (max - min);

	// Give an image a random spot, size and tilt on the stage. Units are container
	// query units (the deck stage sets `container-type: size`), so placement scales
	// with the projected slide.
	function place(src) {
		return {
			src,
			left: rand(0, 84), // % across the stage
			top: rand(0, 80), // % down the stage
			size: rand(9, 16), // heart width in cqw
			rot: rand(-22, 22), // tilt in degrees
			z: Math.floor(rand(1, 100))
		};
	}

	onMount(async () => {
		// Characters are local assets — scatter them immediately.
		hearts = characterUrls.map(place);

		// Audience selfies are listed live from S3 (today's uploads only); append
		// them once they arrive. A failure just leaves the character wall standing.
		try {
			const res = await fetch('/api/list-selfies');
			if (res.ok) {
				const { images } = await res.json();
				hearts = [...hearts, ...images.map(place)];
			}
		} catch {
			// No list (offline / not yet permissioned) — characters still fill the wall.
		}
	});
</script>

<div class="composite" style="background-image: url('{bg}');">
	<!-- Heart clip path, kept inside the component so the url(#...) reference always
	     resolves. objectBoundingBox units (0–1) scale it to whatever it clips. -->
	<svg class="defs" aria-hidden="true" focusable="false">
		<clipPath id="heart-composite" clipPathUnits="objectBoundingBox">
			<path
				d="M.5 .3 C .35 0 0 .05 0 .4 C 0 .65 .3 .85 .5 1 C .7 .85 1 .65 1 .4 C 1 .05 .65 0 .5 .3 Z"
			/>
		</clipPath>
	</svg>

	{#each hearts as h (h.src)}
		<div
			class="heart"
			style="left:{h.left}cqw; top:{h.top}cqh; width:{h.size}cqw; transform:rotate({h.rot}deg); z-index:{h.z};"
		>
			<div class="heart-inner">
				<img src={h.src} alt="" draggable="false" />
			</div>
		</div>
	{/each}
</div>

<style>
	.composite {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		overflow: hidden;
	}

	.defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	.heart {
		position: absolute;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Solid white heart that reads as the border ring around the image. */
		background: #fff;
		clip-path: url(#heart-composite);
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.25));
	}

	.heart-inner {
		width: 92%;
		height: 92%;
		overflow: hidden;
		clip-path: url(#heart-composite);
	}

	.heart-inner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>
