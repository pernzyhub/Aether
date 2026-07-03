import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Welcome to My App</h1>
      <p>
        <Link href="/login">Login with Discord</Link>
      </p>
    </div>
  )
}
