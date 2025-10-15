import { useCallback, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputHtml, setOutputHtml] = useState<string>('')
  const [inputHtml, setInputHtml] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)

  const canProcess = useMemo(() => !!file && !processing, [file, processing])
  const inputBytes = useMemo(() => (inputHtml ? new Blob([inputHtml]).size : 0), [inputHtml])
  const outputBytes = useMemo(() => (outputHtml ? new Blob([outputHtml]).size : 0), [outputHtml])
  const bytesSaved = useMemo(() => (inputBytes && outputBytes ? inputBytes - outputBytes : 0), [inputBytes, outputBytes])
  const pctSaved = useMemo(() => (inputBytes > 0 ? Math.max(0, (bytesSaved / inputBytes) * 100) : 0), [bytesSaved, inputBytes])

  const onFileChosen = useCallback(async (f: File | null) => {
    setFile(f)
    setOutputHtml('')
    setError(null)
    if (f) {
      const text = await f.text().catch(() => '')
      setInputHtml(text)
    } else {
      setInputHtml('')
    }
  }, [])

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

  async function onCopy() {
    if (!outputHtml) return
    try {
      await navigator.clipboard.writeText(outputHtml)
    } catch {
      // no-op
    }
  }

  function formatBytes(n: number) {
    if (!n) return '0 B'
    const units = ['B', 'KB', 'MB']
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFileChosen(f)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">HTML Email URL Shortener</h1>
            <p className="mt-1 text-sm text-slate-600">Shrink links in your email HTML to reduce size and avoid clipping.</p>
          </div>
          <a className="text-sm text-blue-600 hover:underline" href="https://github.com/nieldcarly/url-shortener-service" target="_blank" rel="noreferrer">GitHub</a>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-slate-700">1. Upload HTML</h2>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:bg-slate-50'}`}
              onClick={() => {
                const input = document.getElementById('file-input') as HTMLInputElement | null
                input?.click()
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mb-3 h-8 w-8 text-slate-400"><path d="M7.5 3.75A3.75 3.75 0 0 0 3.75 7.5v9A3.75 3.75 0 0 0 7.5 20.25h9A3.75 3.75 0 0 0 20.25 16.5v-9A3.75 3.75 0 0 0 16.5 3.75h-9ZM12 7.5a.75.75 0 0 1 .75.75v3h3a.75.75 0 0 1 0 1.5h-3v3a.75.75 0 0 1-1.5 0v-3h-3a.75.75 0 0 1 0-1.5h3v-3A.75.75 0 0 1 12 7.5Z" /></svg>
              <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Click to upload</span> or drag and drop</p>
              <p className="mt-1 text-xs text-slate-500">Only .html files</p>
              <input
                id="file-input"
                className="hidden"
                type="file"
                accept=".html,text/html"
                onChange={(e) => onFileChosen(e.target.files?.[0] || null)}
              />
            </div>

            {file && (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="truncate"><span className="font-medium text-slate-700">Selected: </span>{file.name}</div>
                  <div className="ml-4 shrink-0 text-slate-600">{formatBytes(file.size)}</div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onProcess}
                disabled={!canProcess}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Processing…' : 'Process HTML'}
              </button>
              <button
                onClick={() => onFileChosen(null)}
                disabled={processing || (!file && !inputHtml)}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {inputHtml && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="rounded border bg-white p-3">
                  <div className="mb-1 font-medium text-slate-700">Original size</div>
                  <div>{formatBytes(inputBytes)}</div>
                </div>
                <div className="rounded border bg-white p-3">
                  <div className="mb-1 font-medium text-slate-700">Output size</div>
                  <div>{outputHtml ? formatBytes(outputBytes) : '-'}</div>
                </div>
                <div className="col-span-2 rounded border bg-white p-3">
                  <div className="mb-1 font-medium text-slate-700">Estimated savings</div>
                  <div>
                    {outputHtml ? (
                      <span>{formatBytes(Math.max(0, bytesSaved))} ({pctSaved.toFixed(1)}%)</span>
                    ) : (
                      <span className="text-slate-500">Process to see savings</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-slate-700">2. Review & export</h2>
            <div className="mb-3 flex flex-wrap gap-3">
              <button
                onClick={onDownload}
                disabled={!outputHtml}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Download HTML
              </button>
              <button
                onClick={onCopy}
                disabled={!outputHtml}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Copy to Clipboard
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-600">Preview</div>
              <div className="rounded-lg border">
                {outputHtml ? (
                  <iframe className="h-[520px] w-full rounded-lg" srcDoc={outputHtml} />
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">No output yet. Upload and process an HTML file.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
