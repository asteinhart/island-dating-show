// What /voter can display, and which slide triggers each thing.
//
// Two maps:
//   SCENES      — every screen /voter knows how to render, keyed by a short id.
//   SLIDE_SCENE — which scene each deck slide switches voters to, keyed by the
//                 slide's `id` from src/lib/assets/slides/manifest.json.
//
// The presenter deck (/slides) looks up the current slide's id in SLIDE_SCENE
// and writes that scene id to the DB; any slide not listed falls back to 'idle'.
// Because the mapping is keyed by slide id (not slide number), inserting or
// re-exporting slides won't silently point voters at the wrong prompt.

export const SCENES = {
	// The waiting screen — shown whenever no slide is actively asking to vote.
	idle: { kind: 'idle' },

	// A live poll. `voteId` must be stable: it's the key votes are tallied under
	// (see the `votes` table), so keep it the same across the whole show.
	'favorite-contestant': {
		kind: 'vote',
		voteId: 'favorite-contestant',
		title: "Who's your favorite?",
		options: ['Alex', 'Sam', 'Jordan', 'Taylor']
	}
};

// Map slide id -> scene id. Add a line per slide that should drive the voters'
// phones. Example (uncomment and set to the real slide id from the manifest):
//
//   'pinklads': 'favorite-contestant',
//
export const SLIDE_SCENE = {
	black1: 'test1',
	glitch1: 'test2',
	pink1: 'test3'
};

// Presenter side: which scene id a slide should switch voters to.
export function sceneIdForSlideId(slideId) {
	return (slideId && SLIDE_SCENE[slideId]) || 'idle';
}

// Voter side: resolve a stored scene id to its scene object (unknown -> idle).
export function sceneById(sceneId) {
	return SCENES[sceneId] ?? SCENES.idle;
}
