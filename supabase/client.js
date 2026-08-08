/****** Supabase Client ******/

const SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";

window.supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);