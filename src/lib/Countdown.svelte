<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let { value = 0 } = $props<{ value?: number }>();

	function getStartingValue() {
		return value * 60000;
	}

	let remaining = $state(getStartingValue());
	let timer: ReturnType<typeof setInterval> | undefined;

	function formatTime(totalMs: number) {
		const clamped = Math.max(0, totalMs);
		const minutes = Math.floor(clamped / 60000);
		const seconds = Math.floor((clamped % 60000) / 1000);
		const centiseconds = Math.floor((clamped % 1000) / 10);

		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(
			centiseconds
		).padStart(2, '0')}`;
	}

	onMount(() => {
		timer = setInterval(() => {
			remaining = Math.max(0, remaining - 10);
			if (remaining === 0 && timer) clearInterval(timer);
		}, 10);

		return () => {
			if (timer) clearInterval(timer);
		};
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="centerer">
	<span>{formatTime(remaining)}</span>
</div>

<style>
	.centerer {
		display: flex;
		width: 100%;
		height: 100%;
	}

	span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 9ch;
		margin: auto;
		background: #000;
		color: #fff;
		font-size: clamp(3.5rem, 10vw, 8rem);
		font-family: 'SFMono-Regular', 'Roboto Mono', Menlo, Monaco, Consolas, monospace;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
		padding: 0.75rem 1.25rem;
		line-height: 1;
		border-radius: 0.35rem;
	}
</style>
