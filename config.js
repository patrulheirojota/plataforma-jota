const SUPABASE_URL = 'https://hlygwqftnfmywsmajvkz.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_g1To88yIFAty6kkkIeskkQ_XrSkGOaA'

const { createClient } = supabase
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
