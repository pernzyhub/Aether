import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.qlrppdrlyrxwluhbvkbb.supabase.co
const supabaseAnonKey = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscnBwZHJseXJ4d2x1aGJ2a2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODcyODYsImV4cCI6MjA5ODY2MzI4Nn0.BX-j0k4J6I-2oyE9qXldZN1BETjyVxDXMDiTRu54gLg

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
