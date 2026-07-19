// Give every visitor a stable, anonymous voter id the first time they hit the
// site. It lives in an httpOnly cookie (can't be read or spoofed from JS) and
// is what the vote endpoints use to enforce "one vote per (date, vote_id)".
const COOKIE = 'voter_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function handle({ event, resolve }) {
	let voterId = event.cookies.get(COOKIE);

	if (!voterId) {
		voterId = crypto.randomUUID();
		event.cookies.set(COOKIE, voterId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:',
			maxAge: ONE_YEAR
		});
	}

	event.locals.voterId = voterId;
	return resolve(event);
}
