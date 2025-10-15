type Props = {
  outputHtml: string
  onDownload: () => void
  onCopy: () => void
}

export function ReviewExportSection({ outputHtml, onDownload, onCopy }: Props) {
  return (
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
  )
}
