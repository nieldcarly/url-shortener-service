export function Header() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HTML Email URL Shortener</h1>
        <p className="mt-1 text-sm text-slate-600">Shrink links in your email HTML to reduce size and avoid clipping.</p>
      </div>
      <a className="text-sm text-blue-600 hover:underline" href="https://github.com/nieldcarly/url-shortener-service" target="_blank" rel="noreferrer">GitHub</a>
    </header>
  )
}
