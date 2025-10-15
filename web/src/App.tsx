import { useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputHtml, setOutputHtml] = useState<string>('')

  const canProcess = useMemo(() => !!file && !processing, [file, processing])

  async function onProcess() {
    if (!file) return
    setProcessing(true)
    setError(null)
    setOutputHtml('')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const text = await res.text()
      setOutputHtml(text)
    } catch (e: any) {
      setError(e.message || 'Failed to process HTML')
    } finally {
      setProcessing(false)
    }
  }

  function onDownload() {
    const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shortened.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">HTML Email URL Shortener</h1>
          <a className="text-sm text-blue-600 hover:underline" href="https://github.com/nieldcarly/url-shortener-service" target="_blank" rel="noreferrer">GitHub</a>
        </header>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Upload HTML file</label>
              <input
                type="file"
                accept=".html,text/html"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onProcess}
                disabled={!canProcess}
                className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {processing ? 'Processing…' : 'Process HTML'}
              </button>

              <button
                onClick={onDownload}
                disabled={!outputHtml}
                className="inline-flex items-center rounded border px-4 py-2 disabled:opacity-50"
              >
                Download
              </button>
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {outputHtml && (
              <div className="space-y-2">
                <div className="text-sm text-slate-600">Preview</div>
                <iframe className="h-[480px] w-full rounded border" srcDoc={outputHtml} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
