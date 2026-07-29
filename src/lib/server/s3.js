import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

// Bucket holding the shared selfies. Overridable, defaults to the show bucket.
export const S3_BUCKET = env.S3_UPLOAD_BUCKET || env.S3_BUCKET || 'island-dating-show';

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

	client ??= new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
	return client;
}
