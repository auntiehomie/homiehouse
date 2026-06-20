# Image Upload Setup

## Overview
HomieHouse now supports posting images to Farcaster and viewing images in your feed.

## Features
1. **Upload images** - Click the "📷 Upload Image" button in the compose modal
2. **Paste URLs** - Or paste an image URL directly
3. **Image preview** - See your image before posting
4. **View images in feed** - All embedded images are displayed inline

## Setup Required

### Get an ImgBB API Key (Free)

1. Go to https://api.imgbb.com/
2. Sign up for a free account
3. Get your API key
4. Add it to your `.env.local`:

```bash
IMGBB_API_KEY=your_api_key_here
```

### Alternative Image Hosting

If you prefer a different service, you can modify `/src/app/api/upload-image/route.ts` to use:
- **Imgur** - https://api.imgur.com/
- **Cloudinary** - https://cloudinary.com/
- **Your own S3/storage**

## Usage

### Posting Images

1. Click the compose button (✏️)
2. Write your cast text (optional)
3. Click "📷 Upload Image" to select a file, OR paste an image URL
4. Preview your image
5. Click "Post"

### Supported Formats
- JPG/JPEG
- PNG
- GIF
- WebP
- SVG
- BMP
- Max size: 10MB

### Viewing Images in Feed

Images are automatically displayed inline in your feed for any cast that includes an image embed. The feed supports images from:
- imgbb.com
- imgur.com
- imagedelivery.net
- cloudinary.com
- discord
- twitter
- And more...

## Troubleshooting

**"Image upload not configured" error**
- Make sure you've added `IMGBB_API_KEY` to your `.env.local` file
- Restart your dev server after adding the key

**Image doesn't display**
- Check that the URL is publicly accessible
- Verify the image format is supported
- Check browser console for errors

**Upload fails**
- Check file size (must be under 10MB)
- Verify file is an image format
- Check your API key is valid
