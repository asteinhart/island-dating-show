// Single source of truth for what each deck slide *does*, beyond showing its
// static image. Derived from input/ids_config.csv.
//
// Keyed by the slide's stable `id` from src/lib/assets/slides/manifest.json
// (NOT the slide number) so re-exporting or re-ordering slides can't silently
// point the wrong behaviour at the wrong slide.
//
// Each entry may carry any of these optional roles:
//   video   — replace the image with an autoplaying <Video>; { src, loop }
//   vote     — replace the image with the live <Vote> UI;      { type, characters, options? }
//   results  — replace the image with the live <Results> UI;   { type, characters? }
//   mobile   — which mobile/voter screen this slide switches phones to;
//              { id, title, text }. `id` is the slide_id (NOT a number): the
//              deck writes the current slide_id to the presentation_state table,
//              and /mobile matches on it to pick the screen.
//
// A slide can combine roles (e.g. a video that also switches the phone to a
// "Thanks" screen). Plain image slides simply have no entry here.
//
// NOTE ON THE STRUCTURE: the TODO sketched a flat array of typed entries. This
// merges each slide's roles into one keyed record instead, because slides
// frequently need more than one role (a vote slide is also a mobile switch),
// and keying by id gives O(1) lookups from the deck. The four typed views the
// sketch implied are still exposed below via videoSlides/voteSlides/etc.

// --- shared vocab -----------------------------------------------------------

// Where video files live once added (static/videos/<id>.webm -> /videos/<id>.webm).
export const VIDEO_BASE = 'https://island-dating-show.s3.us-east-2.amazonaws.com/videos';
const video = (id, { loop = false } = {}) => ({ src: `${VIDEO_BASE}/${id}.webm`, loop });

// The four original couples. `key` is the short code used in slide ids.
export const COUPLES = [
	{ key: 'cc', name: 'Charlotte & Callum' },
	{ key: 'ha', name: 'Henrietta & Alfie' },
	{ key: 'mt', name: 'Marta & Thaddeus' },
	{ key: 'pr', name: 'Poppi & Rory' }
];

const COUPLE_NAMES = COUPLES.map((c) => c.name);
const ISLAND_DATERS = [
	'Charlotte',
	'Callum',
	'Henrietta',
	'Alfie',
	'Marta',
	'Thaddeus',
	'Poppi',
	'Rory'
];

// Binary "type to a T" prompt reused per couple.
const TYPE_OPTIONS = ["Each Other's Type to a T!", 'Major Typo!'];

// vote.type    'single' = pick one from `characters`; 'double' = binary two-option choice.
// results.type 'full'   = complete ranking;           'winner' = single/partial highlight.

// --- the config -------------------------------------------------------------

export const SLIDE_CONFIG = {
	// Opening
	black1: {
		mobile: {
			id: 'first',
			title: 'Welcome',
			text: 'Welcome to Island Dating Show. Voting will begin shortly.'
		}
	},
	black1: {
		mobile: {
			id: 'black1',
			title: 'Welcome',
			text: 'Welcome to Island Dating Show. Voting will begin shortly.'
		}
	},
	glitch1: { video: video('glitch1') },
	'get-ready1': { mobile: { id: 'get-ready1', title: 'Get Ready', text: 'Get Ready To Vote!' } },

	// Vote 1 — first impressions (favourite couple)
	'vote-first-impression': {
		vote: { type: 'single', characters: COUPLE_NAMES },
		mobile: {
			id: 'vote-first-impression',
			title: 'First Impression',
			text: 'First impressions last forever! <br/> <br/> VOTE NOW for your favorite couple!'
		}
	},
	// Results 1 — winning couple (only the custom=TRUE variant renders live)
	'results-first-impression-cc': {
		results: { type: 'winner', characters: COUPLE_NAMES }
	},

	// Challenge 1 — per-couple binary "type to a T"
	'get-ready2': { mobile: { id: 'get-ready2', title: 'Get Ready', text: 'Get Ready To Vote!' } },
	'type-ha': {
		vote: { type: 'double', characters: ['Henrietta & Alfie'], options: TYPE_OPTIONS },
		mobile: { id: 'type-ha', title: 'Henrietta & Alfie', text: 'Henrietta & Alfie' }
	},
	'type-pr': {
		vote: { type: 'double', characters: ['Poppi & Rory'], options: TYPE_OPTIONS },
		mobile: { id: 'type-pr', title: 'Poppi & Rory', text: 'Poppi & Rory' }
	},
	'type-cc': {
		vote: { type: 'double', characters: ['Charlotte & Callum'], options: TYPE_OPTIONS },
		mobile: { id: 'type-cc', title: 'Charlotte & Callum', text: 'Charlotte & Callum' }
	},
	'type-mt': {
		vote: { type: 'double', characters: ['Marta & Thaddeus'], options: TYPE_OPTIONS },
		mobile: { id: 'type-mt', title: 'Marta & Thad', text: 'Marta & Thad' }
	},
	// Results — most compatible (complete ranking)
	'results-most-compatible': {
		results: { type: 'full', characters: COUPLE_NAMES }
	},

	// First-challenge loser reaction (four alternate takes)
	'video-first-loser-cc': { video: video('video-first-loser-cc') },
	'video-first-loser-ha': { video: video('video-first-loser-ha') },
	'video-first-loser-mt': { video: video('video-first-loser-mt') },
	'video-first-loser-pr': { video: video('video-first-loser-pr') },

	// Vote — hottest (binary)
	'nameless-buttons': {},
	'vote-hottest': {
		vote: { type: 'double', characters: ISLAND_DATERS, options: ['Yes', 'No'] },
		mobile: { id: 'vote-hottest', title: 'Hottest', text: 'Is she the hottest or THE HOTTEST' }
	},

	message2: { mobile: { id: 'message2', title: 'Thanks', text: 'Thanks for voting!' } },

	// Vote — loneliest / biggest flop (pick one dater)
	'vote-loneliest': {
		vote: { type: 'single', characters: ISLAND_DATERS },
		mobile: {
			id: 'vote-loneliest',
			title: 'Loneliest Biggest Flop',
			text: 'VOTE NOW: Who is the loneliest, biggest FLOP??'
		}
	},
	'video-henrietta-lonely': {
		mobile: { id: 'video-henrietta-lonely', title: 'Thanks', text: 'Thanks for voting!' }
	},

	// Commercials & glitches (video)
	commercial1: { video: video('commercial1') },

	// Challenge 2 — raftiest / craftiest (pick one dater)
	'vote-raftiest': {
		vote: { type: 'single', characters: ISLAND_DATERS },
		mobile: {
			id: 'vote-raftiest',
			title: 'Raft',
			text: 'VOTE NOW for the Raftiest, Craftiest Island Dater!'
		}
	},
	// Results — challenge 2 winners (complete ranking)
	'results-challenge-two': { results: { type: 'full', characters: COUPLE_NAMES } },
	'video-two-winner-aw': {
		video: video('video-two-winner-aw'),
		mobile: { id: 'video-two-winner-aw', title: 'Thanks', text: 'Thanks for voting!' }
	},
	'video-two-winner-cc': { video: video('video-two-winner-cc') },
	'video-two-winner-mt': { video: video('video-two-winner-mt') },
	'video-two-winner-pr': { video: video('video-two-winner-pr') },

	// Intermission
	'vote-intermission': {
		vote: { type: 'single', characters: ISLAND_DATERS },
		mobile: {
			id: 'vote-intermission',
			title: 'Intermission Prompts',
			text: 'Intermission prompts (tba) — Vote Now!'
		}
	},
	confessional: { mobile: { id: 'confessional', title: 'Thanks', text: 'Thanks for voting!' } },

	// Vote — favourite Island Dater (pick one couple)
	'vote-favorite': {
		vote: { type: 'single', characters: COUPLE_NAMES },
		mobile: {
			id: 'vote-favorite',
			title: 'Favorite',
			text: 'VOTE NOW for your FAVORITE Island Dater!'
		}
	},
	// Results — ranked reveal, then rigged/edited (all custom=TRUE)
	'results-third-place': { results: { type: 'winner', characters: COUPLE_NAMES } },
	'results-second-place': { results: { type: 'winner', characters: COUPLE_NAMES } },
	'results-rigged': { results: { type: 'full', characters: COUPLE_NAMES } },
	'results-edited': { results: { type: 'full', characters: COUPLE_NAMES } },

	commercial2: {
		video: video('commercial2'),
		mobile: { id: 'commercial2', title: 'Thanks', text: 'Thanks for voting!' }
	},

	// Glitch vote sequence
	'vote-glitch': {
		vote: { type: 'single', characters: ISLAND_DATERS },
		video: video('vote-glitch')
	},
	glitch2: { video: video('glitch2') },
	'vote-alfie': {
		vote: { type: 'double', characters: ['Alfie'], options: ['Yes', 'No'] } // "deserves to get laid AND get his bag!"
	},

	// Vote — Charlotte & Callum (binary)
	'vote-cc': {
		vote: { type: 'single', characters: COUPLE_NAMES },
		mobile: { id: 'vote-cc', title: 'Charlotte & Callum', text: 'VOTE NOW: are Charlotte & Callum' }
	},
	commercial3: { video: video('commercial3') },
	'love-nest2': { mobile: { id: 'love-nest2', title: 'Thanks', text: 'Thanks for voting!' } },

	// Countdown & finale
	'video-timer': { video: video('video-timer') },
	'glitch-loop': { video: video('glitch-loop', { loop: true }) },
	explosion: { video: video('explosion') },

	// Final vote — favourite couple
	'vote-favorite2': {
		vote: { type: 'single', characters: COUPLE_NAMES },
		mobile: {
			id: 'vote-favorite2',
			title: 'Final Vote',
			text: 'VOTE NOW for your FAVORITE Island Dater Couple!'
		}
	},
	// Results — winners (only custom=TRUE variant renders live)
	'results-winners-cc': {
		results: { type: 'winner', characters: COUPLE_NAMES }
	}
};

// --- lookups ----------------------------------------------------------------

/** Full config record for a slide id, or null if the slide is a plain image. */
export function getSlideConfig(slideId) {
	return (slideId && SLIDE_CONFIG[slideId]) || null;
}

/** The single active role a slide plays in the deck: 'video' | 'vote' | 'results' | null. */
export function slideRole(slideId) {
	const c = getSlideConfig(slideId);
	if (!c) return null;
	if (c.video) return 'video';
	if (c.vote) return 'vote';
	if (c.results) return 'results';
	return null; // config exists only to drive the mobile screen
}

/** Mobile/voter screen this slide switches phones to, or null. */
export function mobileForSlide(slideId) {
	return getSlideConfig(slideId)?.mobile ?? null;
}

/** The options a phone should offer for a vote slide (binary -> options, else characters). */
export function voteOptionsForSlide(slideId) {
	const v = getSlideConfig(slideId)?.vote;
	if (!v) return [];
	return v.type === 'double' ? (v.options ?? []) : (v.characters ?? []);
}

// --- outcome-reveal groups --------------------------------------------------
// A set of pre-made slides (one per possible outcome) that collapse into a SINGLE
// deck slide: the deck polls the vote tally, picks the leading (or trailing)
// choice, and reveals that outcome's pre-made asset. Every other member is dropped
// from the deck (its asset is still handed to <Results> so any outcome can show).
//
//   voteId     — the poll to tally (the `vote_id` in the votes table). Its tallied
//                `choice` strings must be the keys of `choiceToId`.
//   primaryId  — the one member kept in the deck (drives navigation + the mobile
//                "Thanks" screen, so it must be a member that has a `mobile` role)
//   choiceToId — map each possible `choice` string (exactly as the phone submits
//                it) to the member slide id that reveals that outcome.
//   kind       — 'image' (default): reveal the outcome's pre-made image.
//                'video': play the outcome's pre-made clip, then advance the deck.
//   select     — 'winner' (default): reveal the most-voted choice; 'loser': least.
//   fallback   — video groups only: member id to play when no votes landed, so a
//                live reveal never strands the show on a "waiting" screen.
//
// To add another reveal, add an entry here — nothing else in the deck changes.
export const RESULTS_GROUPS = {
	'first-impression': {
		voteId: 'vote-first-impression',
		primaryId: 'results-first-impression-cc',
		// choices are the full couple names the phone submits (COUPLE_NAMES).
		choiceToId: Object.fromEntries(
			COUPLES.map((c) => [c.name, `results-first-impression-${c.key}`])
		)
	},
	'vote-favorite2': {
		voteId: 'vote-favorite2',
		primaryId: 'results-winners-cc',
		choiceToId: Object.fromEntries(COUPLES.map((c) => [c.name, `results-winners-${c.key}`]))
	},

	// --- video reveals (results lead to the matching clip, then advance) -------
	// The losing couple of the compatibility challenge (Slide 22, most-compatible
	// ranking) gets their pre-recorded confessional played back — one clip per
	// couple, collapsed to a single deck slide.
	'first-loser': {
		voteId: 'results-most-compatible', // TODO: point at the poll whose tally ranks the couples
		primaryId: 'video-first-loser-cc',
		kind: 'video',
		select: 'loser',
		fallback: 'video-first-loser-cc', // until that tally exists, play this take
		choiceToId: Object.fromEntries(COUPLES.map((c) => [c.name, `video-first-loser-${c.key}`]))
	},
	// The winning couple of Challenge 2 (Slide 66) gets their confessional played
	// back. Note the re-pairings by this point: Alfie is now with the Nameless
	// Onscreen Woman ("aw"), so Henrietta & Alfie map to that clip.
	'challenge-two-winner': {
		voteId: 'results-challenge-two', // TODO: point at the poll whose tally ranks the couples
		primaryId: 'video-two-winner-aw',
		kind: 'video',
		select: 'winner',
		fallback: 'video-two-winner-aw',
		choiceToId: {
			'Charlotte & Callum': 'video-two-winner-cc',
			'Henrietta & Alfie': 'video-two-winner-aw',
			'Marta & Thaddeus': 'video-two-winner-mt',
			'Poppi & Rory': 'video-two-winner-pr'
		}
	}
};

const RESULTS_GROUP_LIST = Object.values(RESULTS_GROUPS);

/** The group this slide is the single deck slide for, or null. */
export function resultsGroupByPrimary(slideId) {
	return RESULTS_GROUP_LIST.find((g) => g.primaryId === slideId) ?? null;
}

/** True if this slide is a non-primary group member and should be dropped from the deck. */
export function isCollapsedGroupMember(slideId) {
	return RESULTS_GROUP_LIST.some(
		(g) => g.primaryId !== slideId && Object.values(g.choiceToId).includes(slideId)
	);
}

// Typed views (the flat lists the TODO sketch implied), each as [{ id, ...role }].
const entriesWith = (role) =>
	Object.entries(SLIDE_CONFIG)
		.filter(([, c]) => c[role])
		.map(([id, c]) => ({ id, ...c[role] }));

export const videoSlides = entriesWith('video');
export const voteSlides = entriesWith('vote');
export const resultsSlides = entriesWith('results');
export const mobileSlides = entriesWith('mobile');
