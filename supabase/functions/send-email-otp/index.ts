import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function emailIsRegistered(supabase: ReturnType<typeof createClient>, email: string) {
  const perPage = 1000

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data.users ?? []
    if (users.some((user) => user.email?.trim().toLowerCase() === email)) return true
    if (users.length < perPage) return false
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, code, purpose } = await req.json()

    if (typeof email !== 'string' || !email.trim() || typeof code !== 'string' || !code) {
      return new Response(
        JSON.stringify({ error: 'Missing email or code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if ((purpose || 'verify') === 'verify') {
      if (await emailIsRegistered(supabase, normalizedEmail)) {
        return new Response(
          JSON.stringify({
            code: 'EMAIL_ALREADY_REGISTERED',
            error: 'An account with this email already exists. Please log in or reset your password.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store OTP code in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: dbError } = await supabase
      .from('email_otp_codes')
      .insert({
        email: normalizedEmail,
        code,
        purpose: purpose || 'verify',
        expires_at: expiresAt,
      })

    if (dbError) {
      console.error('DB error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to store code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #1f4d2e; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Pali<span style="color: #e59834;">Trento</span></h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Tara, Palit Ta sa Trento!</p>
          </div>
          <div style="background: white; border: 1px solid #dcdad3; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
            <h2 style="color: #1c2a20; margin-top: 0;">Your verification code</h2>
            <p style="color: #5b675f; font-size: 16px;">Enter this code to complete your registration:</p>
            <div style="background: #f6f3ec; border: 2px dashed #dcdad3; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; color: #1f4d2e; letter-spacing: 8px; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #5b675f; font-size: 14px; margin-top: 24px;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #5b675f; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #dcdad3; margin: 24px 0;">
            <p style="color: #5b675f; font-size: 12px; margin: 0;">A local directory for the Municipality of Trento, Agusan del Sur</p>
          </div>
        </body>
      </html>
    `

    const emailText = `
PaliTrento - Your verification code

Enter this code to complete your registration: ${code}

This code expires in 10 minutes.
If you didn't request this, please ignore this email.

---
Tara, Palit Ta sa Trento!
A local directory for the Municipality of Trento, Agusan del Sur
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PaliTrento <no-reply@palitrento.online>',
        to: [normalizedEmail],
        subject: 'Your PaliTrento verification code',
        html: emailHtml,
        text: emailText,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      // Clean up the code if email failed
      await supabase.from('email_otp_codes').delete().eq('email', normalizedEmail).eq('code', code)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent:', data)
    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Function error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})