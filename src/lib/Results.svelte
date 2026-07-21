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
	let {
		voteId,
		choiceToId = {}, // outcome choice string -> member slide id
		srcById = {}, // member slide id -> resolved asset URL (image URL, or video src for kind 'video')
		kind = 'image',
		select = 'winner',
		fallback = null,
		onended = () => {},
		date = todayYYYYMMDD(),
		pollMs = 2000 // keep re-tallying so the reveal tracks late votes
	} = $props();

	let tally = $state({}); // { choice: count }
	let ready = $state(false); // has the first poll landed?
	let err = $state('');
	let locked = $state(false); // video kind: freeze the choice once its clip is playing

	// Today's date as YYYYMMDD (local time) — matches how votes are keyed.
	function todayYYYYMMDD() {
		const d = new Date();
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
	}

	// The leading (or trailing) choice among the group's members. Absent members
	// count as zero votes so a shut-out couple can still be the 'loser'. Null until
	// at least one vote lands, so we never reveal a false winner. Ties resolve to
	// whichever member is declared first in choiceToId.
	let outcome = $derived.by(() => {
		const ids = Object.keys(choiceToId);
		const total = ids.reduce((sum, c) => sum + (tally[c] ?? 0), 0);
		if (!total) return null;
		return ids.reduce((best, c) => {
			if (best === null) return c;
			const n = tally[c] ?? 0;
			const bn = tally[best] ?? 0;
			return select === 'loser' ? (n < bn ? c : best) : n > bn ? c : best;
		}, null);
	});
	// Once the first poll has landed with no votes, a video group falls back to its
	// pre-set take so the show never stalls; image groups keep waiting.
	let outcomeSrc = $derived(
		outcome
			? srcById[choiceToId[outcome]]
			: kind === 'video' && ready && fallback
				? srcById[fallback]
				: null
	);

	async function refresh() {
		try {
			const res = await fetch(`/api/votes?date=${date}&vote_id=${voteId}`);
			if (res.ok) tally = (await res.json()).tally ?? {};
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
	<div class="waiting">
		<p>{ready ? 'Waiting for votes…' : 'Tallying votes…'}</p>
		{#if err}<p class="err">{err}</p>{/if}
	</div>
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1cqh;
		background: #0b1d3a;
		color: white;
		font-family: system-ui, sans-serif;
		font-size: 3cqw;
		text-align: center;
	}
	.err {
		color: #ff9a9a;
		font-size: 2cqw;
	}
</style>
