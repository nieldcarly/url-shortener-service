import { useCallback, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { UploadSection } from './components/UploadSection'
import { ReviewExportSection } from './components/ReviewExportSection'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputHtml, setOutputHtml] = useState<string>('')
  const [inputHtml, setInputHtml] = useState<string>('')

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


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-4xl p-6">
        <Header />
        <div className="grid gap-6 lg:grid-cols-2">
          <UploadSection
            file={file}
            inputHtml={inputHtml}
            canProcess={canProcess}
            processing={processing}
            error={error}
            inputBytes={inputBytes}
            outputHtml={outputHtml}
            outputBytes={outputBytes}
            bytesSaved={bytesSaved}
            pctSaved={pctSaved}
            onFileChosen={onFileChosen}
            onProcess={onProcess}
          />
          <ReviewExportSection
            outputHtml={outputHtml}
            onDownload={onDownload}
            onCopy={onCopy}
          />
        </div>
      </div>
    </div>
  )
}

export default App
