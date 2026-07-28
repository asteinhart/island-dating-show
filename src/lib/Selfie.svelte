<script>
	import { onMount } from 'svelte';
	import { toPng } from 'html-to-image';

	const STORAGE_KEY = 'selfie-photo';
	const MAX_DIM = 1080; // downscale so the data URL stays well under the localStorage quota

	let imgSrc = $state('');
	let hasPhoto = $state(false);
	let sharing = $state(false);
	let fileInput;
	let cardEl; // the element we rasterize for sharing

	onMount(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			//imgSrc = saved;
			//hasPhoto = true;
		}
	});

	function pickPhoto() {
		fileInput?.click();
	}

	async function handleFile(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const dataUrl = await resizeToDataUrl(file, MAX_DIM);
			imgSrc = dataUrl;
			hasPhoto = true;
			try {
				localStorage.setItem(STORAGE_KEY, dataUrl);
			} catch (e) {
				// Quota exceeded — keep the photo on screen, just don't persist it.
				console.warn('Could not save selfie to localStorage', e);
			}
		} catch (e) {
			console.error('Could not read photo', e);
		} finally {
			// Reset so picking the same file again still fires `change`.
			event.target.value = '';
		}
	}

	// Draw the image onto a canvas at a capped size and export a compressed JPEG data URL.
	function resizeToDataUrl(file, maxDim) {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
				const w = Math.round(img.width * scale);
				const h = Math.round(img.height * scale);

				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, w, h);

				resolve(canvas.toDataURL('image/jpeg', 0.85));
			};
			img.onerror = (e) => {
				URL.revokeObjectURL(url);
				reject(e);
			};
			img.src = url;
		});
	}

	// Render the card to a PNG and hand it to the native share sheet (mobile),
	// falling back to a download elsewhere. The share UI is tagged
	// `data-capture-ignore` so it never appears in the exported image — that's
	// how the on-screen prompt stays out of the shared picture.
	async function share() {
		if (!cardEl || sharing) return;
		sharing = true;
		try {
			// Make sure the web fonts are loaded before we rasterize the text.
			await document.fonts?.ready;

			const dataUrl = await toPng(cardEl, {
				pixelRatio: 2,
				cacheBust: true,
				filter: (node) => !(node instanceof Element && node.hasAttribute('data-capture-ignore'))
			});

			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], 'island-dating-show.png', { type: 'image/png' });

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file], title: 'Island Dating Show' });
			} else {
				// Desktop / browsers without file-share: just download the image.
				const a = document.createElement('a');
				a.href = dataUrl;
				a.download = 'island-dating-show.png';
				a.click();
			}
		} catch (e) {
			// Dismissing the share sheet throws AbortError — that's not an error.
			if (e?.name !== 'AbortError') console.error('Could not share selfie', e);
		} finally {
			sharing = false;
		}
	}
</script>

<div class="container" bind:this={cardEl}>
	<!-- Heart clip path. Kept INSIDE the card so html-to-image clones it and the
	     url(#heart) reference still resolves in the exported PNG. objectBoundingBox
	     units (0–1) make it scale to whatever element it clips. -->
	<svg class="defs" aria-hidden="true" focusable="false">
		<clipPath id="heart" clipPathUnits="objectBoundingBox">
			<path
				d="M.5 .3 C .35 0 0 .05 0 .4 C 0 .65 .3 .85 .5 1 C .7 .85 1 .65 1 .4 C 1 .05 .65 0 .5 .3 Z"
			/>
		</clipPath>
	</svg>
	<div class="header poppins-bold">I'M THE HOTTEST BOMBSHELL</div>
	<div class="img-container">
		<button type="button" class="img-button" onclick={pickPhoto}>
			<div class="heart">
				<div class="heart-inner">
					{#if hasPhoto}
						<img src={imgSrc} alt="Selfie" />
					{:else}
						<span class="prompt dancing-script-medium">Click to add <br />your image</span>
					{/if}
				</div>
			</div>
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			capture="user"
			onchange={handleFile}
			hidden
		/>
	</div>
	<div class="footer poppins-bold">AT <i> ISLAND <br />DATING SHOW</i></div>

	{#if hasPhoto}
		<!-- Excluded from the shared image via the toPng filter above. -->
		<div class="share-ui" data-capture-ignore>
			<button type="button" class="share-btn poppins-bold" onclick={share} disabled={sharing}>
				{sharing ? 'Preparing…' : '📸 Click to share!'}
			</button>
		</div>
	{/if}
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
		color: #fff;
		font-family: 'Arial', sans-serif;
		text-align: center;
		/* Self-contained background so the exported/shared PNG isn't transparent. */
		background: linear-gradient(#ff40b5, #ffde59);
	}

	.share-ui {
		margin-top: 1.5rem;
	}

	.share-btn {
		padding: 0.9rem 1.8rem;
		font-size: 1.6rem;
		color: var(--color-pink);
		background: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
	}

	.share-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.img-container {
		height: 50vh;
		margin-top: -2rem;
	}

	.img-button {
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	.heart {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		aspect-ratio: 1;
		/* Solid white heart that shows through as the border around the inset content. */
		background: #fff;
		clip-path: url(#heart);
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.25));
	}

	.heart-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 94%;
		height: 94%;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.15);
		clip-path: url(#heart);
	}

	.heart-inner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.prompt {
		padding: 0 10%;
		margin-bottom: 20%;
		font-size: 3rem;
		color: var(--color-pink);
	}

	.header,
	.footer {
		font-size: 2.7rem;
		margin: 1rem 0;
		line-height: 1.2;
	}
</style>
