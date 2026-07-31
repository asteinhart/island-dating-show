import { json } from '@sveltejs/kit';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, S3_BUCKET, publicUrl, dateStamp } from '$lib/server/s3';

// Selfies are uploaded under this prefix as `YYYYMMDD_<uuid>.<ext>` (see
// /api/upload-selfie). The final deck slide only wants TODAY's uploads, so we
// scope the listing to a prefix that includes today's date stamp.
const PREFIX = 'int-imgs/';
const IMG = /\.(webp|jpe?g|png)$/i;

// GET /api/list-selfies -> { images: [url, ...] }
// Lists the audience selfies uploaded today and returns their public URLs.
// Requires the S3 credentials to allow s3:ListBucket on the bucket.
export async function GET() {
	const s3 = getS3();
	// Same shared, timezone-pinned stamp the upload endpoint keys with, so this only
	// ever lists objects whose key starts with today's YYYYMMDD.
	const prefix = `${PREFIX}${dateStamp()}`;

	const urls = [];
	let ContinuationToken;
	do {
		const res = await s3.send(
			new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken })
		);
		for (const obj of res.Contents ?? []) {
			if (obj.Key && obj.Key !== prefix && IMG.test(obj.Key)) {
				urls.push(publicUrl(obj.Key));
			}
		}
		// Follow pagination in case a busy show produces >1000 selfies.
		ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (ContinuationToken);

	// Never cache: the wall should reflect selfies as they land during the show.
	return json({ images: urls }, { headers: { 'cache-control': 'no-store' } });
}
