<script>
	// Placeholder for the live results display shown on the deck's SCORE SCREEN.
	// Reads its shape straight from slideConfig's `results` role.
	//   type: 'full'   — complete ranking of all `characters`
	//   type: 'winner' — highlight a single winning/placed entry
	let { type = 'full', characters = [], voteId } = $props();

	// get results of vote from DB using get
	//const results = await get(`/api/vote/${voteId}`);
</script>

<div class="results-placeholder">
	<div class="tag">RESULTS · {type}</div>

	{#if type === 'winner'}
		<div class="winner">🏆 Winner</div>
		{#if characters.length}<p class="sub">from {characters.length} entries</p>{/if}
	{:else if characters.length}
		<ol class="ranking">
			{#each characters as c, i (c)}
				<li><span class="rank">{i + 1}</span> {c}</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No characters configured</p>
	{/if}
</div>

<style>
	.results-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3cqh;
		background: linear-gradient(#ff40b5, #ffde59);
		color: white;
		font-family: system-ui, sans-serif;
		text-align: center;
		padding: 4cqw;
		box-sizing: border-box;
	}
	.tag {
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-size: 3cqw;
		opacity: 0.7;
	}
	.winner {
		font-size: 7cqw;
		font-weight: 800;
	}
	.sub {
		opacity: 0.7;
		font-size: 2.5cqw;
		margin: 0;
	}
	.ranking {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.2cqh;
		width: min(60cqw, 100%);
	}
	.ranking li {
		display: flex;
		align-items: center;
		gap: 2cqw;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.2cqh 2cqw;
		font-size: 3cqw;
	}
	.rank {
		font-weight: 800;
		color: #ffde59;
		min-width: 2ch;
	}
	.empty {
		opacity: 0.7;
		font-style: italic;
		font-size: 2.5cqw;
	}
</style>
