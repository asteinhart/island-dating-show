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

	// --- character portraits ------------------------------------------------
	// Portraits live in ./assets/characters/<NAME>.webp (uppercase). We glob them
	// once at build time and map by uppercased name so an option string like
	// "Charlotte & Callum" or "Poppi" can look up the right face(s) at runtime.
	const imageModules = import.meta.glob('./assets/characters/*.{webp,png}', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const imageByName = {};
	for (const [path, url] of Object.entries(imageModules)) {
		const key = path
			.split('/')
			.pop()
			.replace(/\.(webp|png)$/i, '')
			.trim()
			.toUpperCase();
		imageByName[key] = url;
	}
	// Display names whose portrait file is stored under a different name.
	const IMAGE_ALIASES = {
		// e.g. ALLIE: 'MILLICENT'  — add if a name has no matching file.
	};
	function imageFor(name) {
		const key = name.trim().toUpperCase();
		return imageByName[IMAGE_ALIASES[key] ?? key] ?? null;
	}

	// Turn a raw option string into something the template can render:
	//   "Charlotte & Callum" -> couple (two portraits, names either side of an &)
	//   "Poppi"              -> single (one portrait to the left of the name)
	//   "THE HOTTEST"        -> text   (a binary label with no portrait)
	function parseOption(option) {
		const parts = option.split(/\s*&\s*/);
		if (parts.length === 2) {
			return {
				kind: 'couple',
				people: parts.map((n) => ({ name: n, img: imageFor(n) }))
			};
		}
		const img = imageFor(option);
		if (img) return { kind: 'single', person: { name: option, img } };
		return { kind: 'text', label: option };
	}

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

{#snippet avatar(person)}
	{#if person.img}
		<img class="avatar" src={person.img} alt={person.name} />
	{:else}
		<span class="avatar avatar-ph">{person.name.trim().charAt(0)}</span>
	{/if}
{/snippet}

<div class="vote" style="--n: {options.length}">
	{#each options as option (option)}
		{@const p = parseOption(option)}
		<button
			class="option {p.kind}"
			class:chosen={choice === option}
			disabled={busy || voted}
			onclick={() => vote(option)}
		>
			{#if p.kind === 'couple'}
				{@render avatar(p.people[0])}
				<span class="names">{p.people[0].name} <span class="amp">&</span> {p.people[1].name}</span>
				{@render avatar(p.people[1])}
			{:else if p.kind === 'single'}
				{@render avatar(p.person)}
				<span class="names">{p.person.name}</span>
			{:else}
				<span class="names label">{p.label}</span>
			{/if}
			{#if choice === option}<span class="check" aria-hidden="true">✓</span>{/if}
		</button>
	{/each}

	{#if voted}<p class="voted">You voted! 💖</p>{/if}
	{#if showResults && total > 0}<p class="total">{total} vote{total === 1 ? '' : 's'}</p>{/if}
	{#if err}<p class="err">{err}</p>{/if}
</div>

<style>
	.vote {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 26rem;
		margin: 0 auto;
	}

	.option {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 4rem;
		padding: 0.5rem 1rem;
		border: 2px solid rgba(255, 255, 255, 0.9);
		border-radius: 1.25rem;
		background: #fff;
		color: #1a1a1a;
		font-family: inherit;
		font-size: 1.1rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
		transition:
			transform 0.12s ease,
			box-shadow 0.2s ease,
			opacity 0.2s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.option:active {
		transform: scale(0.98);
	}

	/* Binary text-only options centre their label. */
	.option.text {
		justify-content: center;
	}
	.option.text .label {
		text-align: center;
	}

	/* A single-dater vote can list 8–9 people, which won't fit a phone screen at
	   the default card height. Size each card (and its portrait) off the remaining
	   viewport height divided by the number of options, shrinking the white box as
	   needed down to a legible floor so the whole list stays on screen. */
	.option.single {
		--row: clamp(2.6rem, calc((100dvh - 12rem) / var(--n, 8) - 0.75rem), 5rem);
		min-height: var(--row);
		padding-top: 0.3rem;
		padding-bottom: 0.3rem;
	}
	.option.single .avatar {
		width: calc(var(--row) - 0.4rem);
		height: calc(var(--row) - 0.4rem);
	}

	.avatar {
		flex-shrink: 0;
		width: 5rem;
		height: 5rem;
		object-fit: cover;
	}

	/* Placeholder used when a name has no matching portrait file. */
	.avatar-ph {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 700;
		color: #ff40b5;
		text-transform: uppercase;
	}

	.names {
		flex: 1;
		min-width: 0;
		line-height: 1.2;
	}
	/* Couples read symmetrically: name  &  name, centred between the two faces. */
	.option.couple .names {
		text-align: center;
	}
	.amp {
		opacity: 0.5;
		font-weight: 500;
		margin: 0 0.15rem;
	}

	/* The chosen option glows in the show's pink→gold gradient. */
	.option.chosen {
		background: linear-gradient(135deg, #ff40b5, #ffde59);
		color: #fff;
		border-color: #fff;
		box-shadow: 0 6px 22px rgba(255, 64, 181, 0.5);
	}
	.option.chosen .amp {
		opacity: 0.85;
		color: #fff;
	}
	.option.chosen .avatar {
		border-color: #fff;
	}

	/* Once voted, fade the paths not taken so the choice stands out. */
	.option:disabled {
		cursor: default;
	}
	.option:disabled:not(.chosen) {
		opacity: 0.5;
		box-shadow: none;
	}

	.check {
		position: absolute;
		top: 0.4rem;
		right: 0.5rem;
		font-size: 0.9rem;
		font-weight: 700;
		color: #fff;
	}

	.voted,
	.total {
		margin: 0.25rem 0 0;
		text-align: center;
		color: #fff;
		filter: drop-shadow(0 0 0.4rem rgba(0, 0, 0, 0.3));
	}
	.voted {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.total {
		font-size: 0.85rem;
		opacity: 0.85;
	}
	.err {
		color: #7a0010;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 0.75rem;
		padding: 0.5rem 0.75rem;
		text-align: center;
		font-size: 0.9rem;
	}
</style>
