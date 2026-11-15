import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use openstreetmap.de static map API (server-side, no CORS)
    const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${z}&size=${w}x${h}&markers=${lat},${lng},red-pushpin&scale=1`;
    console.log('[fetch-static-map] Fetching:', staticMapUrl);

    const response = await fetch(staticMapUrl);
    console.log('[fetch-static-map] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[fetch-static-map] Error response:', errorText);
      throw new Error(`Static map fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log('[fetch-static-map] Response content-type:', contentType);

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    console.log('[fetch-static-map] Base64 length:', base64.length);

    return new Response(JSON.stringify({
      success: true,
      imageBase64: base64,
      mimeType: contentType || 'image/png'
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