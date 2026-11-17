import { supabase } from './supabase.js';

const STORE_IMAGES_BUCKET = 'store-images';
const PRODUCT_IMAGES_BUCKET = 'product-images';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PRODUCT_IMAGES = 3;

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

/**
 * Upload multiple product images (up to MAX_PRODUCT_IMAGES)
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {FileList|File[]} files - Files to upload
 * @returns {Promise<{error: Error|null, urls: string[], paths: string[]}>}
 */
export async function uploadProductImages(userId, productId, files) {
  if (!supabase) return { error: new Error('Not configured'), urls: [], paths: [] };

  const fileArray = Array.from(files).slice(0, MAX_PRODUCT_IMAGES);
  const urls = [];
  const paths = [];

  for (const file of fileArray) {
    // Validate
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: new Error('Choose JPG, PNG or WebP images under 5 MB'), urls: [], paths: [] };
    }
    if (file.size > MAX_SIZE) {
      return { error: new Error('Each image must be under 5 MB'), urls: [], paths: [] };
    }

    // Resize & compress (smaller for product images)
    const blob = await resizeAndCompress(file, 800, 800, 'image/webp', 0.85);
    const ext = '.webp';
    const path = `${userId}/products/${productId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}${ext}`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, blob, { contentType: 'image/webp', upsert: false });

    if (uploadError) {
      // Clean up already uploaded images on failure
      if (paths.length > 0) {
        await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
      }
      return { error: uploadError, urls: [], paths: [] };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(path);

    urls.push(urlData.publicUrl);
    paths.push(path);
  }

  return { error: null, urls, paths };
}

/**
 * Delete multiple product images
 */
export async function deleteProductImages(userId, productId, urls) {
  if (!supabase || !urls?.length) return { error: null };
  try {
    const paths = [];
    for (const url of urls) {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/product-images\/(.+)/);
      if (pathMatch && pathMatch[1].startsWith(`${userId}/products/`)) {
        paths.push(pathMatch[1]);
      }
    }
    if (paths.length > 0) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    }
  } catch {
    // ignore
  }
  return { error: null };
}

/**
 * Delete a single product image (backwards compatibility)
 */
export async function deleteProductImage(userId, productId, url) {
  return deleteProductImages(userId, productId, [url]);
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