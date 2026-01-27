import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Upload to imgbb (free image hosting service)
    // You can also use imgur, cloudinary, or your own storage
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    
    if (!imgbbApiKey) {
      return NextResponse.json(
        { error: "Image upload not configured. Please add IMGBB_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

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
      console.error('Image upload failed:', errorText);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const result = await uploadResponse.json();
    
    if (!result.data?.url) {
      return NextResponse.json(
        { error: "Upload succeeded but no URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: result.data.url,
      deleteUrl: result.data.delete_url
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
