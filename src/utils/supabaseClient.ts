import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback to valid placeholder URL and key if they are invalid or empty
const isUrlValid = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
const supabaseUrl = isUrlValid ? rawUrl : 'https://placeholder.supabase.co';

// Prevent errors if key is placeholder or empty
const isKeyValid = rawKey && rawKey !== 'your-supabase-anon-key';
const supabaseAnonKey = isKeyValid ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
