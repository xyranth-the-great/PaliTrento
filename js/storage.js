import { supabase } from './supabase.js';

const STORE_IMAGES_BUCKET = 'store-images';
const PRODUCT_IMAGES_BUCKET = 'product-images';
const CERTIFICATIONS_BUCKET = 'seller-certifications';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CERTIFICATE_TYPES = ['locational_clearance', 'cedula', 'fire_safety', 'sanitary_permit', 'building_occupancy'];

export async function uploadStoreImage(userId, file, folder = 'storefront') {
  if (!supabase) return { error: new Error('Not configured'), url: null };

  // Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 5 MB'), url: null };
  }
  if (file.size > MAX_SIZE) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 5 MB'), url: null };
  }

  // Resize & compress
  const blob = await resizeAndCompress(file, 1200, 1200, 'image/webp', 0.85);
  const ext = '.webp';
  const path = `${userId}/${folder}/${Date.now()}${ext}`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    return { error: uploadError, url: null };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .getPublicUrl(path);

  return { error: null, url: urlData.publicUrl, path };
}

export async function deleteStoreImage(userId, url) {
  if (!supabase || !url) return { error: null };
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/store-images\/(.+)/);
    if (!pathMatch) return { error: null };
    const path = pathMatch[1];
    // Verify ownership
    if (!path.startsWith(`${userId}/`)) return { error: null };
    await supabase.storage.from(STORE_IMAGES_BUCKET).remove([path]);
  } catch {
    // ignore
  }
  return { error: null };
}

export async function uploadCertification(userId, certificateType, file) {
  if (!supabase) return { error: new Error('Not configured'), path: null };
  if (!CERTIFICATE_TYPES.includes(certificateType)) {
    return { error: new Error('Choose a valid certificate type'), path: null };
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    return { error: new Error('Choose a JPG, PNG, WebP or PDF file under 10 MB'), path: null };
  }

  const extension = file.type === 'application/pdf'
    ? 'pdf'
    : file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : 'webp';
  const path = `${userId}/certifications/${certificateType}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(CERTIFICATIONS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  return error ? { error, path: null } : { error: null, path };
}

export async function uploadProductImage(userId, productId, file) {
  if (!supabase) return { error: new Error('Not configured'), url: null };

  // Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 5 MB'), url: null };
  }
  if (file.size > MAX_SIZE) {
    return { error: new Error('Choose a JPG, PNG or WebP image under 5 MB'), url: null };
  }

  // Resize & compress (smaller for product images)
  const blob = await resizeAndCompress(file, 800, 800, 'image/webp', 0.85);
  const ext = '.webp';
  const path = `${userId}/products/${productId}/${Date.now()}${ext}`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    return { error: uploadError, url: null };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path);

  return { error: null, url: urlData.publicUrl, path };
}

export async function deleteProductImage(userId, productId, url) {
  if (!supabase || !url) return { error: null };
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/product-images\/(.+)/);
    if (!pathMatch) return { error: null };
    const path = pathMatch[1];
    // Verify ownership
    if (!path.startsWith(`${userId}/products/`)) return { error: null };
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
  } catch {
    // ignore
  }
  return { error: null };
}

async function resizeAndCompress(file, maxWidth, maxHeight, mimeType, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, mimeType, quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}