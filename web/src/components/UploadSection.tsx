import { useState } from 'react'
import type React from 'react'
import { formatBytes } from '../lib/format'

type Props = {
  file: File | null
  inputHtml: string
  canProcess: boolean
  processing: boolean
  error: string | null
  inputBytes: number
  outputHtml: string
  outputBytes: number
  bytesSaved: number
  pctSaved: number
  onFileChosen: (f: File | null) => void
  onProcess: () => void
}

export function UploadSection({
  file,
  inputHtml,
  canProcess,
  processing,
  error,
  inputBytes,
  outputHtml,
  outputBytes,
  bytesSaved,
  pctSaved,
  onFileChosen,
  onProcess,
}: Props) {
  const [dragActive, setDragActive] = useState(false)

  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    setDragActive(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFileChosen(f)
  }

  return (
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
  )
}
