<script>
	import Vote from '$lib/Vote.svelte';
</script>

<main>
	<h1>Who's your favorite?</h1>
	<Vote voteId="favorite-contestant" options={['Alex', 'Sam', 'Jordan', 'Taylor']} />
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		margin: 0;
	}
</style>
