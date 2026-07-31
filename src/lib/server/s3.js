import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

// Bucket holding the shared selfies. Overridable, defaults to the show bucket.
export const S3_BUCKET = env.S3_UPLOAD_BUCKET || env.S3_BUCKET || 'island-dating-show';

// Region the bucket lives in — used to build public object URLs.
const S3_REGION = env.S3_UPLOAD_REGION || env.AWS_REGION;

// Public HTTPS URL for a bucket object. Objects under int-imgs/ are world-readable,
// so this URL loads straight in the browser (no presigning needed). Uses the
// region-scoped virtual-hosted endpoint when the region is known.
export function publicUrl(key) {
	const host = S3_REGION
		? `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`
		: `${S3_BUCKET}.s3.amazonaws.com`;
	return `https://${host}/${key}`;
}

// The show runs on a single local calendar day, so both the upload key stamp and the
// wall's listing must agree on what "today" is. Pin it to the event's timezone (not
// UTC): an evening NYC event crosses UTC midnight at 8pm ET, which would otherwise roll
// the date mid-show and split the wall across two prefixes. Override with SELFIE_TZ.
const SHOW_TZ = env.SELFIE_TZ || 'America/New_York';

// YYYYMMDD for `date` (default now) in the show timezone. `en-CA` formats as
// YYYY-MM-DD; drop the dashes to get the key prefix used under int-imgs/.
export function dateStamp(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: SHOW_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
		.format(date)
		.replace(/-/g, '');
}

let client;

// Build the S3 client lazily so a missing config only fails an actual upload
// request — not module import (which SvelteKit's build step does with no env).
// Prefer S3_UPLOAD_* names: Vercel/Lambda reserve the AWS_* prefix, so those
// can't be set as project env vars there. AWS_* is kept as a local-dev fallback.
export function getS3() {
	const region = env.S3_UPLOAD_REGION || env.AWS_REGION;
	const accessKeyId = env.S3_UPLOAD_KEY_ID || env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = env.S3_UPLOAD_SECRET || env.AWS_SECRET_ACCESS_KEY;

	if (!region || !accessKeyId || !secretAccessKey) {
		throw new Error(
			'S3 is not configured. Set S3_UPLOAD_REGION, S3_UPLOAD_KEY_ID and S3_UPLOAD_SECRET.'
		);
	}

	// requestChecksumCalculation: 'WHEN_REQUIRED' stops the SDK (v3.729+) from
	// baking a default CRC32 checksum into the presigned PUT URL. Otherwise it
	// signs x-amz-checksum-crc32 for an empty body; the browser's PUT can't send
	// a matching header, so S3 rejects it and the browser reports a CORS/access
	// control failure.
	client ??= new S3Client({
		region,
		credentials: { accessKeyId, secretAccessKey },
		requestChecksumCalculation: 'WHEN_REQUIRED'
	});
	return client;
}
