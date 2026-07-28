<script module>
	// Latest tally per (date, voteId), shared across every <Results> instance. The
	// deck remounts a fresh <Results> per slide, so without this a slide would open on
	// an empty tally (a zero-vote ordering) until its own first fetch lands. Seeding
	// from this cache lets a slide paint the ranking the previous slide was already
	// showing — e.g. results-edited opens exactly where results-rigged left off, then
	// animates the drop from there rather than snapping into place first.
	const tallyCache = new Map();
	const tallyKey = (date, vid) => `${date}|${vid}`;
</script>

<script>
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';

	// Live results display for the deck's SCORE SCREEN. Pulls the vote tally from
	// GET /api/votes, ranks the entries by that tally, and shows the ranking (with
	// each entry's character image) on the LEFT and the slide's copy on the RIGHT.
	// Its shape comes from slideConfig's `results` role:
	//   type: 'full'   — complete ranking of `characters`
	//   type: 'winner' — highlight the single entry at `place` (default 1st)
	//
	// Scoring:
	//   voteId  — tally this poll; each character's score is its own vote count.
	//   rankBy  — { character: { voteId, choice } }: score each character by the
	//             count of one specific `choice` in `voteId` (used when several
	//             separate polls decide one ranking, e.g. the per-couple type-*
	//             binaries deciding "most compatible").
	// Overrides (applied after ranking, for scripted reveals):
	//   forceFirst    — names pinned to the top (inserted if not otherwise present)
	//   forceLast     — names pinned to the bottom (inserted if not otherwise present)
	//   forceOutOfTop — [{ name, n }]: keep `name` out of the top `n` ranks (demote
	//                   it to rank n+1 if the honest tally would place it higher)
	let {
		type = 'full',
		characters = [],
		text = '',
		voteId = null,
		rankBy = null,
		place = 1,
		forceFirst = [],
		forceLast = [],
		forceOutOfTop = [],
		animateDrop = null, // name to animate falling to last, one rank at a time
		date = todayYYYYMMDD(),
		pollMs = 2000 // keep re-tallying so the ranking tracks late votes
	} = $props();

	// Vote ids this ranking depends on. Plain function (not a $derived) so it can seed
	// `tallies` from the cache before any reactive state exists.
	function neededVoteIds() {
		const ids = new Set();
		if (rankBy) for (const v of Object.values(rankBy)) ids.add(v.voteId);
		else if (voteId) ids.add(voteId);
		return [...ids];
	}

	// Open on the last-known tally (see the cache above) so the first frame already
	// matches the previous slide, instead of a zero-vote placeholder.
	// svelte-ignore state_referenced_locally
	let tallies = $state(
		Object.fromEntries(
			neededVoteIds()
				.map((vid) => [vid, tallyCache.get(tallyKey(date, vid))])
				.filter(([, t]) => t)
		)
	); // { voteId: { choice: count } }
	let ready = $state(false); // has the first poll landed?
	let err = $state('');

	// Today's date as YYYYMMDD (local time) — matches how votes are keyed.
	function todayYYYYMMDD() {
		const d = new Date();
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
	}

	// --- character images -------------------------------------------------------
	// Resolve every character portrait to its final built URL, keyed by an
	// upper-cased file stem (e.g. "CHARLOTTE", "SIR DAVID").
	const imgUrls = import.meta.glob('./assets/characters/*.webp', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const imgByKey = {};
	for (const [path, url] of Object.entries(imgUrls)) {
		imgByKey[
			path
				.split('/')
				.pop()
				.replace(/\.webp$/i, '')
				.toUpperCase()
		] = url;
	}
	// Names that don't map to their own file 1:1.
	const NAME_ALIASES = {
		'NAMELESS ONSCREEN WOMAN': 'WOMAN',
		'ONSCREEN WOMAN': 'WOMAN'
	};
	function fileKey(name) {
		const up = name.trim().toUpperCase();
		return NAME_ALIASES[up] ?? up;
	}
	// A couple ("Charlotte & Callum") yields both member portraits; an individual
	// yields one. Each member is { name, url } (url may be undefined -> initial).
	function portraits(name) {
		const members = name.includes('&') ? name.split('&').map((s) => s.trim()) : [name];
		return members.map((m) => ({ name: m, url: imgByKey[fileKey(m)] }));
	}
	const initial = (name) => name.trim().charAt(0).toUpperCase();

	// --- scoring ----------------------------------------------------------------
	function scoreFor(character) {
		if (rankBy && rankBy[character]) {
			const { voteId: vid, choice } = rankBy[character];
			return tallies[vid]?.[choice] ?? 0;
		}
		if (voteId) return tallies[voteId]?.[character] ?? 0;
		return 0;
	}

	// Rank the characters, breaking ties deterministically so the display never
	// shows two entries at the same rank. Sort by score desc (ties fall back to
	// declaration order), then nudge each entry's score down by 1 as needed so the
	// scores strictly decrease — i.e. "add one as needed" to break ties.
	function rank(chars) {
		const scored = chars.map((c, i) => ({ c, i, score: scoreFor(c) }));
		scored.sort((a, b) => b.score - a.score || a.i - b.i);
		for (let k = 1; k < scored.length; k++) {
			if (scored[k].score >= scored[k - 1].score) {
				scored[k].score = scored[k - 1].score - 1;
			}
		}
		return scored.map((s) => s.c);
	}

	// Apply the scripted overrides in order: pin `forceFirst` to the top and
	// `forceLast` to the bottom (inserting any name not already ranked), then demote
	// each `forceOutOfTop` name to just past its cap. The demotion runs on the
	// assembled list, so a name pinned first counts toward the "top n".
	function applyOverrides(list, fLast = forceLast) {
		const pinned = new Set([...forceFirst, ...fLast]);
		const middle = list.filter((c) => !pinned.has(c));
		const result = [...forceFirst, ...middle, ...fLast];
		for (const { name, n } of forceOutOfTop) {
			const idx = result.indexOf(name);
			if (idx !== -1 && idx < n) {
				result.splice(idx, 1);
				result.splice(Math.min(n, result.length), 0, name);
			}
		}
		return result;
	}

	let ranked = $derived(applyOverrides(rank(characters)));
	// For a 'winner'/placement reveal, the single entry at `place` (1-based).
	let placed = $derived(ranked[Math.max(0, place - 1)] ?? null);

	// --- "drop to last" animation ----------------------------------------------
	// When `animateDrop` names an entry (e.g. the edited reveal drops Callum), show
	// the ranking with that entry still in its honest/rigged spot, then walk it down
	// one rank at a time until it lands last. Once set, `displayOrder` drives the
	// list and freezes the live re-tally for the duration of the fall.
	const DROP_HOLD_MS = 1000; // pause on the "before" order so viewers register it
	const DROP_STEP_MS = 650; // time per one-rank fall
	const dropTimers = [];
	let dropStarted = false;

	// The order the fall STARTS from: the honest ranking WITHOUT pinning `animateDrop`
	// last — i.e. exactly what the preceding results-rigged slide shows. Seeding the
	// first frame from this (plus the shared tally cache above) means results-edited
	// opens right where results-rigged left off, then walks `animateDrop` down to last.
	function dropStartOrder() {
		return applyOverrides(
			rank(characters),
			forceLast.filter((n) => n !== animateDrop)
		);
	}
	// First paint already shows that "before" order, so Callum never flashes at the
	// bottom before falling. Props are fixed for this mount (the deck remounts
	// <Results> per slide), so seeding from their initial value is safe.
	// svelte-ignore state_referenced_locally
	let displayOrder = $state(animateDrop && type === 'full' ? dropStartOrder() : null);
	// The list actually rendered: the animation's frozen order if set, else live.
	let listOrder = $derived(displayOrder ?? ranked);

	function startDropAnimation() {
		let order = dropStartOrder();
		const from = order.indexOf(animateDrop);
		const to = order.length - 1;
		if (from < 0 || from >= to) return; // already last (or absent) — nothing to drop
		displayOrder = order;
		let i = from;
		const step = () => {
			if (i >= to) return;
			const next = order.slice();
			[next[i], next[i + 1]] = [next[i + 1], next[i]]; // fall past the next entry
			order = next;
			displayOrder = next;
			i++;
			dropTimers.push(setTimeout(step, DROP_STEP_MS));
		};
		dropTimers.push(setTimeout(step, DROP_HOLD_MS));
	}

	// Ordinal label for a placement ("1st", "2nd", "3rd", ...).
	function ordinal(n) {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	}

	// --- data -------------------------------------------------------------------
	// Every distinct poll this ranking depends on.
	let voteIdsToFetch = $derived.by(neededVoteIds);

	async function refresh() {
		try {
			const next = {};
			await Promise.all(
				voteIdsToFetch.map(async (vid) => {
					const res = await fetch(`/api/votes?date=${date}&vote_id=${vid}`);
					if (res.ok) next[vid] = (await res.json()).tally ?? {};
				})
			);
			tallies = next;
			// Feed the shared cache so the next slide's <Results> opens on this ranking.
			for (const [vid, tally] of Object.entries(next)) tallyCache.set(tallyKey(date, vid), tally);
		} catch (e) {
			err = e.message;
		} finally {
			ready = true;
			// Kick off the drop once the first real tally has landed (so the fall
			// starts from the honest ranking, not the zero-vote placeholder order).
			if (animateDrop && type === 'full' && !dropStarted) {
				dropStarted = true;
				startDropAnimation();
			}
		}
	}

	onMount(() => {
		refresh();
		const t = setInterval(refresh, pollMs);
		return () => {
			clearInterval(t);
			dropTimers.forEach(clearTimeout);
		};
	});
</script>

<div class="results" class:centered={!text}>
	<div class="left">
		{#if type === 'winner'}
			{#if placed}
				<div class="card winner">
					<div class="badge">{ordinal(place)} Place</div>
					<div class="portraits big">
						{#each portraits(placed) as p (p.name)}
							{#if p.url}
								<img src={p.url} alt={p.name} draggable="false" />
							{:else}
								<span class="fallback">{initial(p.name)}</span>
							{/if}
						{/each}
					</div>
					<div class="name">{placed}</div>
				</div>
			{:else}
				<p class="empty">Waiting for votes…</p>
			{/if}
		{:else if listOrder.length}
			<ol class="ranking" style="--n: {listOrder.length}">
				{#each listOrder as c, i (c)}
					<li animate:flip={{ duration: 420 }}>
						<span class="rank">{i + 1}</span>
						<span class="portraits">
							{#each portraits(c) as p (p.name)}
								{#if p.url}
									<img src={p.url} alt={p.name} draggable="false" />
								{:else}
									<span class="fallback">{initial(p.name)}</span>
								{/if}
							{/each}
						</span>
						<span class="entry-name">{c}</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty">No characters configured</p>
		{/if}
	</div>

	<div class="right">
		{#if text}<p class="copy">{@html text}</p>{/if}
		{#if err}<p class="err">{err}</p>{/if}
	</div>
</div>

<style>
	.results {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 4cqw;
		background: linear-gradient(#ff40b5, #ffde59);
		color: white;
		font-family: system-ui, sans-serif;
		padding: 2.5cqw;
		box-sizing: border-box;
	}
	.left {
		flex: 1 1 55%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2cqh;
		min-width: 0;
	}
	.right {
		flex: 1 1 45%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		text-align: left;
	}
	/* A standalone reveal with no copy (2nd/3rd place cards, or a rigged/edited
	   ranking) has nothing on the right, so give the left the full stage and center
	   it. Cap the ranking width so it reads as a centered column, not full-bleed. */
	.results.centered .left {
		flex-basis: 100%;
	}
	.results.centered .right {
		display: none;
	}
	.results.centered .ranking {
		max-width: 60cqw;
	}
	.copy {
		font-size: 6cqw;
		font-weight: 700;
		line-height: 1.25;
		margin: 0;
		filter: drop-shadow(0 0 0.4rem rgba(0, 0, 0, 0.25));
	}
	.ranking {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.2cqh;
		width: 100%;
	}
	/* Each ranked entry is a white card, echoing the vote screen's option buttons.
	   `--sz` scales the portraits down as the ranking grows so a full 8-entry
	   reveal still fits the stage, while short rankings get big vote-page faces. */
	.ranking li {
		--sz: min(11cqw, calc(62cqh / var(--n, 4)));
		display: flex;
		align-items: center;
		gap: 2cqw;
		background: #fff;
		color: #1a1a1a;
		border-radius: 1.5cqw;
		padding: 1cqh 2cqw;
		font-size: 3cqw;
		box-shadow: 0 0.4cqw 1.4cqw rgba(0, 0, 0, 0.18);
	}
	.rank {
		font-weight: 800;
		color: #ff40b5;
		min-width: 2ch;
		text-align: center;
	}
	.entry-name {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.portraits {
		display: inline-flex;
		align-items: center;
	}
	.portraits img,
	.portraits .fallback {
		width: var(--sz);
		height: var(--sz);
		object-fit: cover;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	/* Only the initial-letter fallback gets the pink chip — real portraits keep
	   their own transparency instead of showing a pink circle behind them. */
	.portraits .fallback {
		background: #ffe3f4;
		color: #ff40b5;
		font-weight: 700;
		font-size: calc(var(--sz) * 0.42);
	}

	/* Overlap the two portraits of a couple slightly. */
	.portraits img:not(:first-child),
	.portraits .fallback:not(:first-child) {
		margin-left: calc(var(--sz) * -0.28);
	}

	/* Winner / placement reveal: one big white card. */
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2cqh;
		background: #fff;
		color: #1a1a1a;
		border-radius: 3cqw;
		padding: 4cqh 4cqw;
		box-shadow: 0 0.6cqw 2cqw rgba(0, 0, 0, 0.22);
	}
	.big {
		--sz: 20cqw;
	}
	.badge {
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 3.5cqw;
		color: #ff40b5;
	}
	.name {
		font-size: 5cqw;
		font-weight: 800;
		color: #1a1a1a;
	}
	.empty {
		opacity: 0.85;
		font-style: italic;
		font-size: 2.5cqw;
		color: white;
	}
	.err {
		color: #7a0010;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 0.75rem;
		padding: 0.4cqh 1cqw;
		font-size: 2cqw;
	}
</style>
