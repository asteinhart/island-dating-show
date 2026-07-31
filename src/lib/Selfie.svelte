<script>
	import { onMount } from 'svelte';
	import { toCanvas } from 'html-to-image';
	import selfieBgr from '$lib/assets/selfie.webp';

	const STORAGE_KEY = 'selfie-photo';
	const MAX_DIM = 1080; // downscale so the data URL stays well under the localStorage quota

	let imgSrc = $state('');
	let hasPhoto = $state(false);
	let sharing = $state(false);
	let fileInput;
	let cardEl; // the element we rasterize for sharing
	let selfieCanvas; // the resized selfie, uploaded to S3 on share
	let selfieUploaded = false; // guard: upload each distinct selfie to S3 only once

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
			const canvas = await resizeToCanvas(file, MAX_DIM);
			selfieCanvas = canvas; // held for upload when the user taps Share
			selfieUploaded = false; // a fresh photo hasn't been uploaded yet
			const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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

	// Draw the image onto a canvas at a capped size. The caller derives whatever it
	// needs from the canvas — a JPEG data URL for display, a JPEG blob for upload.
	function resizeToCanvas(file, maxDim) {
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

				resolve(canvas);
			};
			img.onerror = (e) => {
				URL.revokeObjectURL(url);
				reject(e);
			};
			img.src = url;
		});
	}

	// canvas.toBlob is callback-based — promisify it for a given type/quality.
	function canvasToBlob(canvas, type, quality) {
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error(`toBlob failed for ${type}`))),
				type,
				quality
			);
		});
	}

	// Ask the server for a presigned PUT URL, then upload the bytes straight to
	// S3. Fire-and-forget: failures here must never block or break sharing.
	async function uploadToS3(blob, contentType) {
		try {
			const res = await fetch('/api/upload-selfie', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ contentType })
			});
			if (!res.ok) throw new Error(`presign failed: ${res.status}`);
			const { url } = await res.json();

			const put = await fetch(url, {
				method: 'PUT',
				headers: { 'content-type': contentType },
				body: blob
			});
			if (!put.ok) throw new Error(`upload failed: ${put.status}`);
			console.log('Selfie uploaded to S3', { contentType, bytes: blob.size });
			return true;
		} catch (e) {
			console.warn('Could not upload selfie to S3', e);
			return false;
		}
	}

	// Render the card once to a canvas and derive a PNG from it for the native share
	// sheet / download (mobile). The share UI is tagged `data-capture-ignore` so it
	// never appears in the export — that's how the on-screen prompt stays out.
	// Separately, the raw selfie (the image taken) is uploaded to S3 in the background.
	async function share() {
		if (!cardEl || sharing) return;
		sharing = true;
		try {
			// Upload just the selfie (the image taken) to S3 in the background —
			// fire-and-forget so it never blocks or breaks sharing. Encode as JPEG:
			// iOS Safari can't encode WebP from a canvas (toBlob returns null / falls
			// back to PNG), so a WebP upload silently fails on iPhone.
			// Guarded so tapping Share again on the same photo doesn't upload a second
			// copy — otherwise the same selfie shows up twice on the wall. Mark it up
			// front so rapid double-taps can't race, and clear it if the upload fails so
			// a genuine failure can still retry on the next tap.
			if (selfieCanvas && !selfieUploaded) {
				selfieUploaded = true;
				canvasToBlob(selfieCanvas, 'image/jpeg', 0.9)
					.then((jpg) => uploadToS3(jpg, 'image/jpeg'))
					.then((ok) => {
						if (!ok) selfieUploaded = false;
					})
					.catch((e) => {
						selfieUploaded = false;
						console.warn('Could not encode selfie', e);
					});
			}

			// Make sure the web fonts are loaded before we rasterize the text.
			await document.fonts?.ready;

			const options = {
				pixelRatio: 2,
				// No cacheBust: reusing the same URLs lets the browser cache the
				// background between warm-up passes so it's ready for the final one.
				filter: (node) => !(node instanceof Element && node.hasAttribute('data-capture-ignore'))
			};

			// iOS Safari drops images on the first pass — the cloned <img> and CSS
			// background nodes haven't decoded yet, so the card rasterizes with only
			// its text and shapes. Rendering a few times warms html-to-image's cache
			// so the final canvas has the photo and background baked in.
			let canvas;
			for (let i = 0; i < 3; i++) {
				canvas = await toCanvas(cardEl, options);
			}

			const pngBlob = await canvasToBlob(canvas, 'image/png');
			const file = new File([pngBlob], 'island-dating-show.png', { type: 'image/png' });

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file], title: 'Island Dating Show' });
			} else {
				// Desktop / browsers without file-share: just download the image.
				const a = document.createElement('a');
				a.href = canvas.toDataURL('image/png');
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

<div
	class="container"
	bind:this={cardEl}
	style="background-image: url('{selfieBgr}'); background-size: cover; background-position: center; background-repeat: no-repeat;"
>
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
				{sharing ? 'Preparing…' : '📸 Share!'}
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
		min-height: 100dvh;
		width: 100%;
		color: #fff;
		font-family: 'Arial', sans-serif;
		text-align: center;
		padding: 0;
	}

	.share-ui {
		position: absolute;
		bottom: 2rem;
		margin: 0 auto;
	}

	.share-btn {
		padding: 0.5rem 1rem;
		font-size: 1.2rem;
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
		margin-bottom: 15;
		font-size: 3rem;
		color: var(--color-pink);
	}

	.header,
	.footer {
		font-size: 2.7rem;
		margin: 1rem 0;
		line-height: 1.2;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7));
	}
</style>
