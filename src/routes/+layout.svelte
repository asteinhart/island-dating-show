<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../global.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Island Dating Show</title>
</svelte:head>

{@render children()}
