import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use a static map service that works from Supabase Edge Functions
// Stadia Maps (tiles.stadiamaps.com) works well and supports CORS
function buildStaticMapUrl(lat: number, lng: number, zoom: number, width: number, height: number): string {
  // Use Stadia Maps static map API (free tier, no API key needed for low volume)
  // Format: https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png
  // But for static image we need a different approach - use their static map service
  // Actually, let's use the Stadia Maps static map which supports center, zoom, size, markers
  return `https://tiles.stadiamaps.com/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin&key=`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[fetch-static-map] Request body:', body);

    const { lat, lng, zoom, width, height } = body;

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: 'Missing lat/lng' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const z = zoom || 16;
    const w = width || 300;
    const h = height || 200;

    // Try multiple static map providers in order
    const providers = [
      // Stadia Maps - known to work from edge functions
      `https://tiles.stadiamaps.com/staticmap?center=${lat},${lng}&zoom=${z}&size=${w}x${h}&markers=${lat},${lng},red-pushpin`,
      // MapTiler (free tier)
      `https://api.maptiler.com/maps/streets/static/${lat},${lng},${z}/${w}x${h}.png?key=`,
      // OpenStreetMap tile-based (construct from tiles)
    ];

    let imageBase64 = '';
    let mimeType = 'image/png';
    let lastError = '';

    for (const staticMapUrl of providers) {
      try {
        console.log('[fetch-static-map] Trying:', staticMapUrl);
        const response = await fetch(staticMapUrl);
        console.log('[fetch-static-map] Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[fetch-static-map] Provider failed:', staticMapUrl, response.status, errorText);
          lastError = `${response.status}: ${errorText}`;
          continue;
        }

        const contentType = response.headers.get('content-type');
        console.log('[fetch-static-map] Response content-type:', contentType);

        const imageBlob = await response.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        console.log('[fetch-static-map] Success with:', staticMapUrl, 'Base64 length:', base64.length);

        imageBase64 = base64;
        mimeType = contentType || 'image/png';
        break;
      } catch (providerError) {
        console.warn('[fetch-static-map] Provider error:', staticMapUrl, providerError);
        lastError = providerError.message;
        continue;
      }
    }

    if (!imageBase64) {
      throw new Error(`All static map providers failed. Last error: ${lastError}`);
    }

    return new Response(JSON.stringify({
      success: true,
      imageBase64,
      mimeType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-static-map] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});