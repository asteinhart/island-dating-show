import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// GET /api/state -> { state, slideId, updatedAt }
// The current scene id that /voter should display, plus the deck slide id that
// drove it. Voters poll this.
export async function GET() {
	const [row] = await sql`
		select state, slide_id, updated_at from presentation_state where id = 1
	`;

	return json({
		state: row?.state ?? 'idle',
		slideId: row?.slide_id ?? null,
		updatedAt: row?.updated_at ?? null
	});
}

// POST /api/state  { state, slideId? }  -> upsert the single state row.
// Called by the presenter deck (/slides) on every slide change. No auth: this
// is a same-room live show. Add a shared-secret header if that ever matters.
export async function POST({ request }) {
	const { state, slideId = null } = await request.json();

	if (typeof state !== 'string' || !state) {
		throw error(400, 'state (non-empty string) is required');
	}

	if (slideId !== null && typeof slideId !== 'string') {
		throw error(400, 'slideId must be a string or null');
	}

	const [row] = await sql`
		insert into presentation_state (id, state, slide_id, updated_at)
		values (1, ${state}, ${slideId}, now())
		on conflict (id) do update set state = ${state}, slide_id = ${slideId}, updated_at = now()
		returning state, slide_id, updated_at
	`;

	return json({ state: row.state, slideId: row.slide_id, updatedAt: row.updated_at });
}
