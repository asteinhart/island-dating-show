<script>
	import { onMount } from 'svelte';

	// The current title-final slide image, passed from the deck as the backdrop
	// we scatter the hearts over.
	let { bg = '' } = $props();

	// The three themed props are decorative — they need the drawn heart frame like the
	// selfies, unlike the cast portraits which already have a border baked in.
	const PROP_FILES = ['Disco Jellyfish', 'Drunk Flamingo', 'Musical Unicorn'];

	// Every bundled portrait/prop, resolved to URLs at build time and tagged so props get
	// the drawn frame while cast portraits keep their baked-in border.
	const bundled = Object.entries(
		import.meta.glob('./assets/characters/*.webp', {
			eager: true,
			query: '?url',
			import: 'default'
		})
	).map(([path, src]) => ({
		src,
		isCharacter: !PROP_FILES.some((name) => path.includes(name))
	}));

	// Each heart carries its own random placement, computed once when it's added,
	// so the characters don't jump around when the selfies finish loading.
	let hearts = $state([]);

	const rand = (min, max) => min + Math.random() * (max - min);

	// Fisher–Yates in place; returns the same array so it can be chained.
	const shuffle = (a) => {
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};

	// The stage is a fixed 16:9 box (matches .stage in the deck). Overlap math runs in
	// these pixel units because a heart's `left`/`size` are %-of-width (cqw) while its
	// `top` is %-of-height (cqh) — different scales that only reconcile in pixels.
	const STAGE_W = 1440;
	const STAGE_H = 809;

	// Keep the scatter clear of the centred title ("island dating show" + subtitle).
	// Box is in stage %: left, top, width, height.
	const TEXT_ZONE = { left: 10, top: 44, width: 80, height: 21 };

	const HEART_MAX = 15; // biggest heart, in cqw (% of stage width) — at the reference count
	const HEART_MIN = 6; // floor once the wall gets crowded — at the reference count
	const HEART_FLOOR = 4.2; // hearts never shrink below this, however full the wall gets
	const REF_COUNT = 20; // image count HEART_MAX/HEART_MIN are tuned for; more → smaller hearts
	const PAD = 0.7; // radius fudge; <1 lets hearts nestle closer so more fit on the wall
	const ATTEMPTS = 800; // random tries before we give up on an image
	const REVEAL_STEP = 110; // ms between each heart fading in, one at a time

	// Bounding circle of a heart placement, in stage pixels.
	function circleOf(left, top, size) {
		const d = (size / 100) * STAGE_W; // heart box is square in pixels (aspect-ratio 1)
		return {
			cx: (left / 100) * STAGE_W + d / 2,
			cy: (top / 100) * STAGE_H + d / 2,
			r: (d / 2) * PAD
		};
	}

	// The text zone as a pixel rect.
	const textRect = {
		x: (TEXT_ZONE.left / 100) * STAGE_W,
		y: (TEXT_ZONE.top / 100) * STAGE_H,
		w: (TEXT_ZONE.width / 100) * STAGE_W,
		h: (TEXT_ZONE.height / 100) * STAGE_H
	};

	// Does a heart's circle touch the text box? (circle vs. axis-aligned rect)
	const hitsText = (c) => {
		const nx = Math.max(textRect.x, Math.min(c.cx, textRect.x + textRect.w));
		const ny = Math.max(textRect.y, Math.min(c.cy, textRect.y + textRect.h));
		const dx = c.cx - nx;
		const dy = c.cy - ny;
		return dx * dx + dy * dy < c.r * c.r;
	};

	// Does a heart's circle touch any heart already on the stage?
	const hitsHeart = (c, placed) =>
		placed.some((o) => {
			const dx = c.cx - o.cx;
			const dy = c.cy - o.cy;
			const reach = c.r + o.r;
			return dx * dx + dy * dy < reach * reach;
		});

	// Find a spot for one image that clears the text and every heart already down.
	// Hearts start at `heartMax` and shrink toward `heartMin` as tries fail, so a crowded
	// wall still packs in. `heartMax`/`heartMin` are scaled to the total image count by the
	// caller, so more images just means smaller hearts rather than dropped ones. Returns
	// null — image skipped — only if even the floor size can't find a gap.
	function place(item, placed, heartMax, heartMin) {
		for (let i = 0; i < ATTEMPTS; i++) {
			const cap = heartMax - (heartMax - heartMin) * (i / ATTEMPTS);
			const size = rand(Math.max(heartMin, cap - 3), cap);
			const wPct = size; // width as % of stage width
			const hPct = size * (STAGE_W / STAGE_H); // same pixels tall, as % of height
			const left = rand(0, 100 - wPct);
			const top = rand(0, 100 - hPct);
			const c = circleOf(left, top, size);
			if (hitsText(c) || hitsHeart(c, placed)) continue;
			placed.push(c);
			return {
				src: item.src,
				isCharacter: item.isCharacter,
				left,
				top,
				size,
				rot: rand(-22, 22),
				z: Math.floor(rand(1, 100))
			};
		}
		return null;
	}

	// Last-resort placement for an image that couldn't find a clear gap: put it at the
	// floor size in the spot with the *least* overlap, accepting a little overlap so the
	// image still shows rather than being dropped. Always returns a placement.
	function forcePlace(item, placed) {
		const size = HEART_FLOOR;
		const wPct = size;
		const hPct = size * (STAGE_W / STAGE_H);
		let best = null;
		let bestScore = Infinity;
		for (let i = 0; i < ATTEMPTS; i++) {
			const left = rand(0, 100 - wPct);
			const top = rand(0, 100 - hPct);
			const c = circleOf(left, top, size);
			if (hitsText(c)) continue;
			// Sum how deeply this spot overlaps everything already down; keep the least-bad.
			let score = 0;
			for (const o of placed) {
				const dx = c.cx - o.cx;
				const dy = c.cy - o.cy;
				const gap = (c.r + o.r) * (c.r + o.r) - (dx * dx + dy * dy);
				if (gap > 0) score += gap;
			}
			if (score < bestScore) {
				bestScore = score;
				best = { left, top, c };
			}
			if (score === 0) break; // a clear spot turned up after all
		}
		// Every candidate hit the title box (should never happen) — just drop it somewhere.
		if (!best) {
			const left = rand(0, 100 - wPct);
			const top = rand(0, 100 - hPct);
			best = { left, top, c: circleOf(left, top, size) };
		}
		placed.push(best.c);
		return {
			src: item.src,
			isCharacter: item.isCharacter,
			left: best.left,
			top: best.top,
			size,
			rot: rand(-22, 22),
			z: Math.floor(rand(1, 100))
		};
	}

	onMount(async () => {
		// Audience selfies are listed live from S3 (today's uploads only). Wait for that
		// list before placing anything so the whole wall — characters + selfies — lays
		// out in one pass: it packs against the full set and pops in once, instead of
		// characters landing first and re-flowing when the selfies arrive. A slow or
		// failed request (offline / not yet permissioned) falls back to characters only,
		// so the wall always stands.
		let selfieUrls = [];
		try {
			console.log('Fetching selfie list...');
			const res = await fetch('/api/list-selfies', { signal: AbortSignal.timeout(5000) });
			console.log(res.ok);
			if (res.ok) ({ images: selfieUrls } = await res.json());
			console.log(selfieUrls);
		} catch {
			// No list — characters still fill the wall.
		}

		// Selfies are the whole point of the wall, so every one gets a spot. Shuffle them
		// for a varied reveal, then lay them out shrinking the size range as needed. Sizes
		// scale as 1/sqrt(count) — area (∝ size²) is what shares the stage — and never grow
		// past the tuned defaults nor below HEART_FLOOR, so selfies stay recognisable.
		const selfies = shuffle(selfieUrls.map((src) => ({ src, isCharacter: false })));

		// Circles already claimed, so nothing placed later lands on them.
		const placed = [];
		let selfieHearts = [];
		let scale = Math.min(1, Math.sqrt(REF_COUNT / Math.max(selfies.length, 1)));
		let heartMax = HEART_MAX;
		let heartMin = HEART_MIN;
		for (let attempt = 0; attempt < 6; attempt++) {
			placed.length = 0;
			heartMax = HEART_MAX * scale;
			heartMin = Math.max(HEART_FLOOR, HEART_MIN * scale);
			selfieHearts = selfies.map((s) => place(s, placed, heartMax, heartMin));
			if (selfieHearts.every(Boolean)) break; // every selfie found a clear gap
			scale *= 0.85; // some were dropped — shrink the whole wall and re-lay
		}
		// Guarantee: any selfie that still couldn't find a clear gap is force-placed with a
		// little overlap, so a selfie is never dropped from the wall.
		selfieHearts = selfieHearts.map((h, i) => h ?? forcePlace(selfies[i], placed));

		// Cast portraits + props are just filler for whatever room the selfies left. They
		// take normal placement into the remaining gaps and are simply skipped if they don't
		// fit — so a full selfie wall shows few (or no) characters and never drops a selfie.
		const chars = shuffle([...bundled]);
		const charHearts = chars.map((c) => place(c, placed, heartMax, heartMin)).filter(Boolean);

		const laid = [...selfieHearts, ...charHearts];

		// Reveal one at a time in a random order, so selfies and characters fade in
		// intermixed rather than every selfie first.
		shuffle([...laid]).forEach((h, i) => (h.delay = i * REVEAL_STEP));
		hearts = laid;
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
			class:character={h.isCharacter}
			style="left:{h.left}cqw; top:{h.top}cqh; width:{h.size}cqw; --rot:{h.rot}deg; z-index:{h.z}; animation-delay:{h.delay}ms;"
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
		transform: rotate(var(--rot, 0deg));
		/* Each heart fades + pops in on its own delay (set inline) so they arrive one at
		   a time; `both` holds it hidden through the delay and visible after. */
		opacity: 0;
		animation: heart-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes heart-in {
		from {
			opacity: 0;
			transform: rotate(var(--rot, 0deg)) scale(0.4);
		}
		to {
			opacity: 1;
			transform: rotate(var(--rot, 0deg)) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.heart {
			animation: none;
			opacity: 1;
		}
	}

	/* Character portraits already have a heart border baked into the asset, so drop the
	   drawn white frame + heart clip and let the image fill the box as-is. */
	.heart.character {
		background: none;
		clip-path: none;
	}

	.heart.character .heart-inner {
		width: 100%;
		height: 100%;
		clip-path: none;
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
