<script>
	// Placeholder for the live vote display shown on the deck's SCORE SCREEN.
	// Reads its shape straight from slideConfig's `vote` role.
	//   type: 'single' — pick one of `characters`
	//   type: 'double' — binary choice between `options`
	let { type = 'single', characters = [], options = [] } = $props();
</script>

<div class="vote-placeholder">
	<div class="tag">VOTE · {type}</div>

	{#if type === 'double' && options.length}
		<div class="options">
			{#each options as opt (opt)}
				<div class="option">{opt}</div>
			{/each}
		</div>
	{/if}

	{#if characters.length}
		<ul class="characters">
			{#each characters as c (c)}
				<li>{c}</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">No characters configured</p>
	{/if}
</div>

<style>
	.vote-placeholder {
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
		opacity: 0.85;
	}
	.options {
		display: flex;
		gap: 2cqw;
		flex-wrap: wrap;
		justify-content: center;
	}
	.option {
		border: 3px solid white;
		border-radius: 999px;
		padding: 1.5cqh 3cqw;
		font-size: 3.5cqw;
		font-weight: 600;
	}
	.characters {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 1.5cqw;
		flex-wrap: wrap;
		justify-content: center;
	}
	.characters li {
		background: rgba(255, 255, 255, 0.25);
		border-radius: 12px;
		padding: 1cqh 2cqw;
		font-size: 3cqw;
	}
	.empty {
		opacity: 0.7;
		font-style: italic;
		font-size: 2.5cqw;
	}
</style>
