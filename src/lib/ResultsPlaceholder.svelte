<script>
	import { onMount } from 'svelte';

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
		date = todayYYYYMMDD(),
		pollMs = 2000 // keep re-tallying so the ranking tracks late votes
	} = $props();

	let tallies = $state({}); // { voteId: { choice: count } }
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
		imgByKey[path.split('/').pop().replace(/\.webp$/i, '').toUpperCase()] = url;
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
	function applyOverrides(list) {
		const pinned = new Set([...forceFirst, ...forceLast]);
		const middle = list.filter((c) => !pinned.has(c));
		const result = [...forceFirst, ...middle, ...forceLast];
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

	// Ordinal label for a placement ("1st", "2nd", "3rd", ...).
	function ordinal(n) {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	}

	// --- data -------------------------------------------------------------------
	// Every distinct poll this ranking depends on.
	let voteIdsToFetch = $derived.by(() => {
		const ids = new Set();
		if (rankBy) for (const v of Object.values(rankBy)) ids.add(v.voteId);
		else if (voteId) ids.add(voteId);
		return [...ids];
	});

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
		} catch (e) {
			err = e.message;
		} finally {
			ready = true;
		}
	}

	onMount(() => {
		refresh();
		const t = setInterval(refresh, pollMs);
		return () => clearInterval(t);
	});
</script>

<div class="results">
	<div class="left">
		{#if type === 'winner'}
			{#if placed}
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
			{:else}
				<p class="empty">Waiting for votes…</p>
			{/if}
		{:else if ranked.length}
			<ol class="ranking">
				{#each ranked as c, i (c)}
					<li>
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
		padding: 4cqw;
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
	.copy {
		font-size: 4cqw;
		font-weight: 700;
		line-height: 1.25;
		margin: 0;
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
	.ranking li {
		display: flex;
		align-items: center;
		gap: 2cqw;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1cqh 2cqw;
		font-size: 3cqw;
	}
	.rank {
		font-weight: 800;
		color: #ffde59;
		min-width: 2ch;
		text-align: center;
	}
	.entry-name {
		font-weight: 600;
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
		width: 4cqw;
		height: 4cqw;
		border-radius: 50%;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.2);
		border: 2px solid rgba(255, 255, 255, 0.6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 2cqw;
	}
	/* Overlap the two portraits of a couple slightly. */
	.portraits img:not(:first-child),
	.portraits .fallback:not(:first-child) {
		margin-left: -1.2cqw;
	}
	.big img,
	.big .fallback {
		width: 12cqw;
		height: 12cqw;
		font-size: 5cqw;
	}
	.big img:not(:first-child),
	.big .fallback:not(:first-child) {
		margin-left: -3cqw;
	}
	.badge {
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 3.5cqw;
		color: #ffde59;
	}
	.name {
		font-size: 5cqw;
		font-weight: 800;
	}
	.empty {
		opacity: 0.7;
		font-style: italic;
		font-size: 2.5cqw;
	}
	.err {
		color: #ff9a9a;
		font-size: 2cqw;
	}
</style>
