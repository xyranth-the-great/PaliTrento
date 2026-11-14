import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:no-reply@palitrento.online';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { advisoryId, title, body, category, priority, barangay, url } = await req.json();

    if (!advisoryId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build filter for target users
    let query = supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    // If barangay specified, filter users by barangay
    if (barangay) {
      const { data: usersInBarangay } = await supabase
        .from('profiles')
        .select('id')
        .eq('barangay', barangay);
      const userIds = usersInBarangay?.map(u => u.id) || [];
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No users in barangay' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      query = query.in('user_id', userIds);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send push notifications using web-push
    // We'll use a simple implementation without external library
    const sent = await sendWebPushNotifications(
      subscriptions,
      { title, body, category, priority, advisoryId, url: url || '/' },
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    return new Response(JSON.stringify({ sent, message: `Sent to ${sent} devices` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendWebPushNotifications(
  subscriptions: Array<{ user_id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: { title: string; body: string; category: string; priority: string; advisoryId: string; url: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<number> {
  let sent = 0;
  const payloadJson = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      const success = await sendPushToSubscription(sub, payloadJson, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (success) sent++;
    } catch (err) {
      console.error(`Failed to send to ${sub.user_id}:`, err);
      // If subscription is invalid (410 Gone), delete it
      if (err.status === 410) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }

  return sent;
}

async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  // Generate VAPID headers
  const vapidHeaders = generateVAPIDHeaders(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      ...vapidHeaders,
    },
    body: await encryptPayload(payload, subscription.p256dh, subscription.auth),
  });

  if (!response.ok) {
    const error = new Error(`Push failed: ${response.status} ${response.statusText}`);
    (error as any).status = response.status;
    throw error;
  }

  return true;
}

function generateVAPIDHeaders(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Record<string, string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Generate JWT for VAPID
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    sub: vapidSubject,
  };

  const token = await signJWT(header, claims, vapidPrivateKey);

  return {
    'Authorization': `vapid t=${token}, k=${vapidPublicKey}`,
  };
}

// Simplified JWT signing using Web Crypto API
async function signJWT(header: object, claims: object, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import private key
  const privateKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and decode base64
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, ''));
  const keyData = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyData[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'pkcs8',
    keyData.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  // Web Push encryption (RFC 8291) - simplified implementation
  // For production, use a proper library like web-push
  const encoder = new TextEncoder();
  return encoder.encode(payload);
}