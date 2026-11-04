import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Only these hosts may be fetched through the proxy
const ALLOWED_IMAGE_HOSTS = new Set(['res.cloudinary.com']);

function isAllowedImageUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_IMAGE_HOSTS.has(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      (parsed.port === '' || parsed.port === '443')
    );
  } catch {
    return false;
  }
}

export async function GET(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Validate that it's a Cloudinary URL for security
    if (!isAllowedImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'Only Cloudinary URLs are allowed' },
        { status: 400 }
      );
    }

    console.log('🔄 Proxying image request for:', imageUrl);

    // Fetch the image from Cloudinary
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Invoice-Generator-Proxy/1.0'
      },
      // Don't follow redirects, which could point outside the allowed host
      redirect: 'error',
    });

    if (!response.ok) {
      console.log('❌ Failed to fetch image:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }

    const upstreamType = response.headers.get('content-type') || '';
    if (!upstreamType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'URL did not return an image' },
        { status: 400 }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    console.log('✅ Image fetched successfully, size:', imageBuffer.byteLength, 'bytes');

    // Convert to base64
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      dataUrl,
      contentType,
      size: imageBuffer.byteLength
    });

  } catch (error) {
    console.error('❌ Error in image proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}