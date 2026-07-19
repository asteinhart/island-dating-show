<div
	class="deck"
	role="button"
	tabindex="0"
	aria-label="Slideshow. Use arrow keys or click to navigate."
	onclick={onClick}
>
	<div class="stage">
		<!-- Welcome / title slide -->
		<div class="welcome">
			<div class="dancing-script-medium">Welcome to</div>
			<div class="poppins-bold">Island Dating Show</div>
		</div>
	</div>
</div>

<style>
	.deck {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
		overflow: hidden;
		cursor: pointer;
		user-select: none;
	}

	/* Fixed 16:9 stage (1440x809), scaled to fit the viewport. */
	.stage {
		position: relative;
		aspect-ratio: 1440 / 809;
		width: min(100vw, 100vh * 1440 / 809);
		overflow: hidden;
		container-type: size;
	}

	.welcome {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 7cqw;
		line-height: 1.2;
		color: white;
		background: linear-gradient(#ff40b5, #ffde59);
	}

	.slide-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.counter {
		position: absolute;
		bottom: 1rem;
		right: 1.25rem;
		font-size: 0.9rem;
		font-family: system-ui, sans-serif;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.35);
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		pointer-events: none;
	}
</style>
