import { json, error } from '@sveltejs/kit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3, S3_BUCKET, dateStamp } from '$lib/server/s3';

// Map the accepted upload content types to a file extension. The browser signs
// and PUTs with the exact same Content-Type, so keep this list tight.
const EXT_BY_TYPE = {
	'image/webp': 'webp',
	'image/png': 'png',
	'image/jpeg': 'jpg'
};

const PREFIX = 'int-imgs/';
const URL_TTL = 300; // seconds the presigned PUT URL stays valid

// POST /api/upload-selfie  { contentType? }
// Mints a short-lived presigned PUT URL. The browser uploads the image bytes
// straight to S3 with that URL — the payload never touches this function.
export async function POST({ request }) {
	let contentType = 'image/webp';
	try {
		const body = await request.json();
		if (body?.contentType) contentType = body.contentType;
	} catch {
		// No/invalid body — fall back to the webp default.
	}

	const ext = EXT_BY_TYPE[contentType];
	if (!ext) {
		throw error(400, `Unsupported contentType: ${contentType}`);
	}

	// Stamp per-request (not at module load) so a long-running server can't keep using a
	// stale date after the day rolls over. Must match list-selfies' prefix exactly.
	const key = `${PREFIX}${dateStamp()}_${crypto.randomUUID()}.${ext}`;

	const url = await getSignedUrl(
		getS3(),
		new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
		{ expiresIn: URL_TTL }
	);

	return json({ url, key, contentType });
}
