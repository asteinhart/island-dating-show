<script>
	import { onMount } from 'svelte';

	let { voteId, options = [], date = todayYYYYMMDD(), showResults = true } = $props();

	let choice = $state(null); // this visitor's choice, if any
	let voted = $state(false); // has this visitor already voted?
	let tally = $state({}); // { option: count }
	let total = $state(0);
	let busy = $state(false);
	let err = $state('');

	const params = () => new URLSearchParams({ date, vote_id: voteId });

	// Today's date as YYYYMMDD (local time).
	function todayYYYYMMDD() {
		const d = new Date();
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
	}

	// The cookie set on the server identifies this visitor — ask whether they've
	// already voted, and (optionally) load the running tally.
	async function refresh() {
		const [statusRes, resultsRes] = await Promise.all([
			fetch(`/api/votes/check?${params()}`),
			showResults ? fetch(`/api/votes?${params()}`) : Promise.resolve(null)
		]);

		if (statusRes.ok) {
			const status = await statusRes.json();
			voted = status.voted;
			choice = status.choice ?? choice;
		}
		if (resultsRes?.ok) {
			const data = await resultsRes.json();
			tally = data.tally;
			total = data.total;
		}
	}

	async function vote(option) {
		if (voted || busy) return;
		busy = true;
		err = '';
		try {
			const res = await fetch('/api/votes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ date, vote_id: voteId, choice: option })
			});
			if (res.status === 409) {
				// Already voted (e.g. from another tab) — reflect it instead of erroring.
				voted = true;
				await refresh();
				return;
			}
			if (!res.ok) throw new Error(await res.text());
			choice = option;
			voted = true;
			await refresh();
		} catch (e) {
			err = e.message;
		} finally {
			busy = false;
		}
	}

	onMount(refresh);
</script>

<div class="vote">
	{#each options as option (option)}
		<button
			class="option"
			class:selected={choice === option}
			disabled={busy || voted}
			onclick={() => vote(option)}
		>
			{#if showResults}<span class="bar" style="width:100%"></span>{/if}
			<span class="label">{option}</span>
		</button>
	{/each}

	{#if voted}<p class="voted">Thanks for voting.</p>{/if}
	{#if showResults}<p class="total">{total} vote{total === 1 ? '' : 's'}</p>{/if}
	{#if err}<p class="err">{err}</p>{/if}
</div>

<style>
	.vote {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: system-ui, sans-serif;
		max-width: 24rem;
	}
	.option {
		position: relative;
		overflow: hidden;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 2px solid #ff40b5;
		border-radius: 999px;
		background: white;
		color: #111;
		font-size: 1rem;
		cursor: pointer;
	}
	.option:disabled {
		cursor: default;
		opacity: 0.7;
	}
	.option.selected {
		border-color: #111;
		font-weight: 700;
	}
	.bar {
		position: absolute;
		inset: 0 auto 0 0;
		background: linear-gradient(90deg, #ff40b5, #ffde59);
		opacity: 0.35;
		transition: width 0.3s ease;
	}
	.label,
	.total {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		opacity: 0.6;
	}
	.voted {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.err {
		color: #c00;
		font-size: 0.85rem;
	}
</style>
