<div class="deck">
	<div class="stage">
		<img
			id="title-final"
			class="slide-img"
			src="https://island-dating-show.s3.amazonaws.com/slides/slide-122.webp"
			width="1440"
			height="809"
			alt={'title-final' ?? `Slide ${current}`}
			draggable="false"
		/>
	</div>
</div>

<style>
	.slide-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
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
</style>
