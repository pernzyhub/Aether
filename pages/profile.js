import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Profile() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!user) {
    return <p>Not logged in. Go to /login</p>
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Profile</h2>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}
