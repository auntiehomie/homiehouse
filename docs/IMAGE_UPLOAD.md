# Cast image uploads

HomieHouse uploads cast images through `/api/upload-image` and attaches the returned HTTPS URL to the signed cast. Image uploads require an authenticated account with cast-write permission. Images are rendered inline in feeds and cast conversations. JPEG, PNG, GIF, and WebP are supported, up to 10 MB each and four photos per cast.

## QStorage (preferred)

When QStorage is configured, it is the primary upload provider. The server uses the S3-compatible API at `https://qstorage.quilibrium.com` and uploads objects with a public-read ACL. Public media is necessary because casts are public and clients need a stable URL that does not expire. These images are publicly retrievable; do not upload private photos.

Create a QStorage bucket and an access key with bucket write and object-ACL permissions, then configure these **server-only** environment variables in local development and the hosting environment:

```dotenv
QSTORAGE_ACCESS_KEY_ID=...
QSTORAGE_SECRET_ACCESS_KEY=...
QSTORAGE_BUCKET=...
```

Optional settings:

```dotenv
QSTORAGE_ENDPOINT=https://qstorage.quilibrium.com
QSTORAGE_REGION=q-world-1
QSTORAGE_PUBLIC_BASE_URL=https://<bucket>.qstorage.quilibrium.com
```

QStorage has a global region; the app defaults to `q-world-1`. The public base URL must serve the bucket's public objects without credentials or an expiring signature. Verify that an uploaded image opens in a private browser window before enabling QStorage for production. Never expose either credential in a `NEXT_PUBLIC_` variable or client code.

After uploading, the server fetches the permanent public URL without credentials and verifies its image content type and exact bytes. A successful authenticated upload alone is insufficient. AccessDenied, missing objects, invalid image responses, and network failures trigger the existing Pinata/ImgBB fallback. Partial configuration also triggers fallback. If no provider succeeds, the upload fails instead of returning the inaccessible QStorage URL.

## Existing fallback providers

If QStorage is not configured or its upload/public verification fails, the upload route tries Pinata when `PINATA_JWT` is set and then ImgBB when `IMGBB_API_KEY` is set. Keep these credentials server-side as well.

## Live QStorage smoke test

With QStorage credentials and a bucket configured locally, run:

```bash
npm run test:qstorage:live
```

The script uploads a tiny temporary PNG, fetches it through the public URL without credentials, checks its bytes and content type, and deletes the temporary object. It exits with an error when the required credentials are missing; a skipped run is not a live provider test.

## Troubleshooting

- **Image upload is not configured:** set QStorage credentials, or configure `PINATA_JWT` / `IMGBB_API_KEY`.
- **Upload fails on QStorage:** check that the access key has `s3:PutObject` and `s3:PutObjectAcl` access to the bucket. Check the server log for the QStorage error code, HTTP status, and request ID.
- **Existing casts show AccessDenied:** the cast already contains a permanent QStorage URL. Restore public read access to those specific objects and verify the configured public bucket proxy URL; this code change cannot rewrite signed casts. Do not use expiring signed URLs for cast embeds. See [QStorage public access documentation](https://docs.quilibrium.com/docs/api/q-storage/user-manual/working-with-buckets/edit-bucket-visibility/).
- **Image is not visible:** open its URL in a private browser window. Confirm the object is public and the public URL base is correct.
- **Images exceed upload limits:** use JPEG, PNG, GIF, or WebP under 10 MB; casts can contain up to four photos.
