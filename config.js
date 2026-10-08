/**
 * University Attendance Automator - Supabase Configuration
 * 
 * Replace the placeholder values below with your Supabase Project settings.
 * You can find these in your Supabase Dashboard:
 * Settings -> API -> Project URL & Project API Keys (anon / public)
 * 
 * IMPORTANT:
 * ONLY use the 'anon' / 'public' / 'publishable' key here.
 * NEVER use or expose the 'service_role' key.
 */

const SUPABASE_CONFIG = {
  // Your Supabase Project URL
  SUPABASE_URL: "https://uyhfpkhzedsvnkewvtnx.supabase.co",

  // Your Supabase Anon / Publishable Key
  SUPABASE_ANON_KEY: "sb_publishable_rr6NCqZvsaxv2UHbRNqTLw_iWPtc4v1"
};

// Export for environments that support ES / CommonJS / Browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUPABASE_CONFIG;
}
