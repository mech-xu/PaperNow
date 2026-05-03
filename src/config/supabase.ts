export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
}

// Validate required config
if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  console.warn('[PaperNow] Supabase config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}
