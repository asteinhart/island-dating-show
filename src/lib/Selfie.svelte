<script>
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'selfie-photo';
	const MAX_DIM = 1080; // downscale so the data URL stays well under the localStorage quota

	let imgSrc = $state('');
	let hasPhoto = $state(false);
	let fileInput;

	onMount(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			imgSrc = saved;
			hasPhoto = true;
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
</script>

<div class="container">
	<div class="header poppins-bold">THE HOTTEST BOMBSHELL</div>
	<div class="img-container">
		<button type="button" class="img-button" onclick={pickPhoto}>
			<div class="heart">
				<div class="heart-inner">
					{#if hasPhoto}
						<img src={imgSrc} alt="Selfie" />
					{:else}
						<span class="prompt poppins-bold">Click to add <br />your image</span>
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
	}

	.img-container {
		height: 50vh;
	}

	.img-button {
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.heart {
		--heart: shape(from 50% 91%, line to 90% 50%, arc to 50% 9% of 1%, arc to 10% 50% of 1%);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		aspect-ratio: 1;
		margin-top: 5%;
		/* Solid white heart that shows through as the border around the inset content. */
		background: #fff;
		clip-path: var(--heart);
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
		clip-path: var(--heart);
	}

	.heart-inner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.prompt {
		padding: 0 10%;
		margin-bottom: 15%;
		font-size: 1.5rem;
		color: #fff;
	}

	.header,
	.footer {
		font-size: 2.7rem;
		margin: 1rem 0;
		line-height: 1.2;
	}
</style>
