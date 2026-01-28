import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from '@/lib/validation';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/upload-image');
  logger.start();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file with comprehensive checks
    validateImageFile(file);

    // Upload to imgbb (free image hosting service)
    // You can also use imgur, cloudinary, or your own storage
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    
    if (!imgbbApiKey) {
      logger.error('IMGBB_API_KEY not configured');
      return NextResponse.json(
        { error: "Image upload not configured. Please add IMGBB_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    logger.info('Uploading image', { 
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size 
    });

    // Upload to imgbb
    const uploadFormData = new FormData();
    uploadFormData.append('key', imgbbApiKey);
    uploadFormData.append('image', base64);

    const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logger.error('Image upload failed', { status: uploadResponse.status, error: errorText });
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const result = await uploadResponse.json();
    
    if (!result.data?.url) {
      logger.error('Upload succeeded but no URL returned');
      return NextResponse.json(
        { error: "Upload succeeded but no URL returned" },
        { status: 500 }
      );
    }

    logger.success('Image uploaded successfully', { url: result.data.url });
    logger.end();

    return NextResponse.json({
      ok: true,
      url: result.data.url,
      deleteUrl: result.data.delete_url
    });

  } catch (error: any) {
    logger.error('Upload failed', error);
    return handleApiError(error, 'POST /upload-image');
  }
}
