<script>
	import { onMount } from 'svelte';
	import Video from '$lib/Video.svelte';

	// Live outcome reveal for the deck. Polls a vote's tally, picks the leading
	// (or trailing) choice, and reveals that outcome's pre-made asset — collapsing
	// a group of per-outcome slides into one. Driven by RESULTS_GROUPS in
	// slideConfig.js.
	//
	//   kind 'image' (default) reveals the outcome's pre-made slide image and keeps
	//     re-tallying so a late vote can still flip the reveal.
	//   kind 'video' plays the outcome's pre-made clip once, locks the choice so a
	//     late vote can't swap the source mid-play, and calls `onended` so the deck
	//     advances to the slide after the group.
	//
	//   select 'winner' (default) picks the most-voted choice; 'loser' the least.
	//   fallback — member slide id to reveal when no votes landed (keeps a video
	//     group from stranding the show on a "waiting" screen). Optional.
	//
	// Scoring (mirrors <Results>): by default each choiceToId key is scored by its
	// own vote count in the single `voteId` poll. When the outcome is decided across
	// SEVERAL polls, pass `rankBy` instead — { choice: { voteId, choice } } — and each
	// choiceToId key is scored by the count of its specific `choice` in its own poll
	// (e.g. the four type-* binaries deciding the compatibility loser).
	let {
		voteId = null,
		rankBy = null, // { choice: { voteId, choice } } — score across multiple polls
		choiceToId = {}, // outcome choice string -> member slide id
		srcById = {}, // member slide id -> resolved asset URL (image URL, or video src for kind 'video')
		kind = 'image',
		select = 'winner',
		fallback = null,
		onended = () => {},
		date = todayYYYYMMDD(),
		pollMs = 2000 // keep re-tallying so the reveal tracks late votes
	} = $props();

	let tallies = $state({}); // { voteId: { choice: count } }
	let ready = $state(false); // has the first poll landed?
	let err = $state('');
	let locked = $state(false); // video kind: freeze the choice once its clip is playing

	// Every distinct poll this reveal depends on: the rankBy specs' polls, else the
	// single `voteId`.
	function neededVoteIds() {
		const ids = new Set();
		if (rankBy) for (const v of Object.values(rankBy)) ids.add(v.voteId);
		else if (voteId) ids.add(voteId);
		return [...ids];
	}
	let voteIdsToFetch = $derived.by(neededVoteIds);

	// Score for one choiceToId key: its `choice` count in its rankBy poll, or its own
	// vote count in the single poll.
	function scoreFor(choice) {
		if (rankBy && rankBy[choice]) {
			const { voteId: vid, choice: ch } = rankBy[choice];
			return tallies[vid]?.[ch] ?? 0;
		}
		return tallies[voteId]?.[choice] ?? 0;
	}

	// Today's date as YYYYMMDD (local time) — matches how votes are keyed.
	function todayYYYYMMDD() {
		const d = new Date();
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
	}

	// Rank the members exactly as <Results> does — score desc, ties broken by
	// declaration order in choiceToId — so a reveal always agrees with the score
	// screen. (Reusing the same sort is why first-loser reveals whoever the
	// results-most-compatible ranking shows LAST, even on a tie for the bottom.)
	function rank(chars) {
		return chars
			.map((c, i) => ({ c, i, score: scoreFor(c) }))
			.sort((a, b) => b.score - a.score || a.i - b.i)
			.map((s) => s.c);
	}

	// The leading (winner) or trailing (loser) member. Absent members count as zero
	// votes so a shut-out couple can still be the 'loser'. Null until at least one
	// vote lands, so we never reveal a false winner.
	let outcome = $derived.by(() => {
		const ids = Object.keys(choiceToId);
		const total = ids.reduce((sum, c) => sum + scoreFor(c), 0);
		if (!total) return null;
		const ranked = rank(ids);
		return select === 'loser' ? ranked[ranked.length - 1] : ranked[0];
	});
	$inspect(outcome, 'outcome');
	$inspect(tallies, 'tallies');
	// The chosen outcome's asset, or — once the first poll has landed with no votes —
	// the pre-set fallback take so a video group never stalls on a "waiting" screen.
	let outcomeSrc = $derived(
		outcome ? srcById[choiceToId[outcome]] : ready && fallback ? srcById[fallback] : null
	);

	$inspect(outcomeSrc, 'outcomeSrc');

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
		const t = setInterval(() => {
			if (locked) return; // a playing video reveal has settled on its choice
			refresh();
		}, pollMs);
		return () => clearInterval(t);
	});

	// Freeze a video reveal as soon as its clip is chosen, so a late vote can't
	// swap the source out from under a playing <Video>.
	$effect(() => {
		if (kind === 'video' && outcomeSrc) locked = true;
	});
</script>

{#if outcomeSrc && kind === 'video'}
	<Video src={outcomeSrc} {onended} />
{:else if outcomeSrc}
	<img class="slide-img" src={outcomeSrc} alt={`Winner: ${outcome}`} draggable="false" />
{:else}
	<div class="waiting"></div>
{/if}

<style>
	.slide-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.waiting {
		width: 100%;
		height: 100%;
		background: linear-gradient(#ff40b5, #ffde59);
	}
	.err {
		color: #ff9a9a;
		font-size: 2cqw;
	}
</style>
