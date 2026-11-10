import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// null when keys are missing -> pages fall back to seed data
export const supabase = url && key && !url.includes('YOUR-PROJECT') ? createClient(url, key) : null;
