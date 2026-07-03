import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
    })
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Login</h2>
      <button onClick={handleLogin}>Login with Discord</button>
    </div>
  )
}
