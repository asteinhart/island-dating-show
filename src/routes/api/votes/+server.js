import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// POST /api/votes  -> record this visitor's vote (one per date + vote_id)
// body: { date: "YYYYMMDD", vote_id, choice }
// The voter is identified by the httpOnly cookie set in hooks.server.js.
export async function POST({ request, locals }) {
	const { date, vote_id, choice } = await request.json();
	const voterId = locals.voterId;

	if (!date || !vote_id || !choice) {
		throw error(400, 'date, vote_id and choice are all required');
	}

	// Insert only if this voter hasn't already voted on this (date, vote_id).
	// `do nothing` means a duplicate returns no row -> they already voted.
	const [row] = await sql`
		insert into votes (date, vote_id, voter_id, choice)
		values (${date}, ${vote_id}, ${voterId}, ${choice})
		on conflict (date, vote_id, voter_id) do nothing
		returning *
	`;

	if (!row) {
		throw error(409, 'You have already voted.');
	}

	return json(row, { status: 201 });
}

// GET /api/votes?date=YYYYMMDD&vote_id=xxx  -> public tally for that day + vote
export async function GET({ url }) {
	const date = url.searchParams.get('date');
	const vote_id = url.searchParams.get('vote_id');

	if (!date || !vote_id) {
		throw error(400, 'date and vote_id query params are required');
	}

	const rows = await sql`
		select choice, count(*)::int as count
		from votes
		where date = ${date} and vote_id = ${vote_id}
		group by choice
	`;

	const tally = {};
	let total = 0;
	for (const { choice, count } of rows) {
		tally[choice] = count;
		total += count;
	}

	return json({ tally, total });
}
