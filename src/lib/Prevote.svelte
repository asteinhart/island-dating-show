<script>
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import QR from '$lib/assets/qr.png';

	// Pre-show holding screen for the deck (slide 0). LEFT: the three setpiece
	// props, each a thumbnail + its live vote bar, re-ranked as votes land. RIGHT:
	// the "vote now" call-to-action and a QR code. Voters submit from their phones
	// (see the 'vote-preshow' entry in slideConfig), and this screen polls the same
	// poll — GET /api/votes?vote_id=vote-preshow — the same way <Results> does.
	let { voteId = 'vote-preshow', date = todayYYYYMMDD(), pollMs = 2000 } = $props();

	// The three setpiece props. Colours are placeholders until real photos are
	// supplied — drop an <img> into `.thumb` and remove the background. Each prop's
	// colour travels with it as the ranking reorders.
	const PROPS = [
		{ name: 'Musical Unicorn', color: '#e63946' }, // red
		{ name: 'Disco Jellyfish', color: '#2f80ed' }, // blue
		{ name: 'Drunk Flamingo', color: '#27ae60' } // green
	];

	// Prop photos live alongside the character portraits in ./assets/characters/,
	// keyed by uppercased file name (e.g. "Musical Unicorn.webp" -> MUSICAL UNICORN).
	// A prop with no matching file falls back to its colour swatch below.
	const imageModules = import.meta.glob('./assets/characters/*.webp', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const imageByName = {};
	for (const [path, url] of Object.entries(imageModules)) {
		const key = path
			.split('/')
			.pop()
			.replace(/\.(webp|png)$/i, '')
			.trim()
			.toUpperCase();
		imageByName[key] = url;
	}
	const imageFor = (name) => imageByName[name.trim().toUpperCase()] ?? null;

	let tally = $state({}); // { propName: count }
	let total = $state(0);

	// Today's date as YYYYMMDD (local time) — matches how votes are keyed.
	function todayYYYYMMDD() {
		const d = new Date();
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
	}

	// Rank the props by vote count (desc), breaking ties by declaration order, and
	// attach each one's live percentage of the total.
	let ranked = $derived(
		PROPS.map((p, i) => {
			const count = tally[p.name] ?? 0;
			return {
				...p,
				i,
				count,
				img: imageFor(p.name),
				pct: total ? Math.round((count / total) * 100) : 0
			};
		}).sort((a, b) => b.count - a.count || a.i - b.i)
	);

	// Bar width tracks the percentage directly (capped at 100%). The bar can shrink
	// (flex-shrink) so the percentage label always fits — the row never overflows.
	const barWidth = (pct) => `${Math.min(pct, 100)}%`;

	async function refresh() {
		try {
			const res = await fetch(`/api/votes?date=${date}&vote_id=${voteId}`);
			if (res.ok) {
				const data = await res.json();
				tally = data.tally ?? {};
				total = data.total ?? 0;
			}
		} catch {
			// keep showing the last tally on a transient network blip
		}
	}

	onMount(() => {
		refresh();
		const t = setInterval(refresh, pollMs);
		return () => clearInterval(t);
	});
</script>

<div class="prevote">
	<div class="left">
		{#each ranked as p, i (p.name)}
			<div class="row" animate:flip={{ duration: 500 }}>
				<!-- Prop photo when one exists; the colour swatch shows through behind
				     transparent PNGs and stands in entirely when there's no file yet. -->
				<div class="thumb" style="background: {p.color}">
					{#if p.img}<img src={p.img} alt={p.name} />{/if}
				</div>
				<div class="info">
					<div class="name">{i + 1}. {p.name}</div>
					<div class="bar-row">
						<div class="bar" style="width: {barWidth(p.pct)}"></div>
						<span class="pct">{p.pct}%</span>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="right">
		<p class="cta">VOTE NOW for your favorite setpiece icon!</p>
		<!-- QR code placeholder; drop the supplied <img> in here. -->
		<div class="qr" aria-label="QR code">
			<img src={QR} alt="QR code" />
		</div>
	</div>
</div>

<style>
	.prevote {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 3cqw;
		padding: 4cqw 5cqw;
		box-sizing: border-box;
		background: #06aedb;
		color: #fff;
		font-family: 'Poppins', sans-serif;
	}

	/* LEFT — ranked prop rows */
	.left {
		flex: 1 1 56%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 5cqh;
		min-width: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 3cqw;
	}
	.thumb {
		flex: 0 0 auto;
		width: 12cqw;
		aspect-ratio: 1 / 1;
		border-radius: 1cqw;
		border: 0.5cqw solid #fff;
		box-shadow: 0 0.4cqw 1.2cqw rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.6cqh;
	}
	.name {
		font-size: 3cqw;
		font-weight: 700;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 1.5cqw;
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}
	.bar {
		/* Shrink (not overflow) if the bar + label would exceed the row width. */
		flex: 0 1 auto;
		height: 5.5cqh;
		min-width: 0;
		max-width: 100%;
		background: #f0389f;
		border-radius: 999px;
		transition: width 0.5s ease;
	}
	.pct {
		flex: 0 0 auto;
		font-size: 3cqw;
		font-weight: 600;
		white-space: nowrap;
	}

	/* RIGHT — call to action + QR */
	.right {
		flex: 1 1 44%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6cqh;
		text-align: center;
	}
	.cta {
		margin: 0;
		max-width: 12ch;
		font-size: 5cqw;
		font-weight: 700;
		line-height: 1.05;
		filter: drop-shadow(0 0 0.4rem rgba(0, 0, 0, 0.18));
	}
	.qr {
		width: 20cqw;
		aspect-ratio: 1 / 1;
		background: #000;
		border-radius: 1cqw;
	}

	.qr img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
