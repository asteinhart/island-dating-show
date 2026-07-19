import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// GET /api/votes/check?date=YYYYMMDD&vote_id=xxx
// Has the current visitor (from their cookie) already voted on this poll?
// -> { voted: boolean, choice: string | null }
export async function GET({ url, locals }) {
	const date = url.searchParams.get('date');
	const vote_id = url.searchParams.get('vote_id');

	if (!date || !vote_id) {
		throw error(400, 'date and vote_id query params are required');
	}

	const [row] = await sql`
		select choice from votes
		where date = ${date} and vote_id = ${vote_id} and voter_id = ${locals.voterId}
		limit 1
	`;

	return json({ voted: Boolean(row), choice: row?.choice ?? null });
}
