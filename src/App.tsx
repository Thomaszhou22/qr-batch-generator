import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import {
  QrCode, Plus, Trash2, Download, FileText, Upload,
  Palette, Maximize, Sparkles, Zap, ArrowRight, X, Link2
} from 'lucide-react'

interface QRItem {
  id: string
  label: string
  content: string
  dataUrl?: string
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function normalizeContent(content: string): string {
  const trimmed = content.trim()
  if (/^https?:\/\//i.test(trimmed) || trimmed === '') return trimmed
  if (/^[\w\-]+(\.[\w\-]+)+/.test(trimmed) && !/\s/.test(trimmed)) {
    return 'https://' + trimmed
  }
  return trimmed
}

async function generateQR(item: QRItem, color: string, size: number): Promise<string> {
  return QRCode.toDataURL(normalizeContent(item.content), {
    width: size,
    margin: 1,
    color: { dark: color, light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

const COLORS = [
  { name: '经典黑', value: '#1e293b' },
  { name: '深蓝', value: '#1d4ed8' },
  { name: '靛蓝', value: '#4f46e5' },
  { name: '翠绿', value: '#059669' },
  { name: '玫红', value: '#db2777' },
  { name: '橙色', value: '#ea580c' },
  { name: '紫色', value: '#7c3aed' },
  { name: '青色', value: '#0891b2' },
]

const SIZES = [
  { label: 'S', value: 160, desc: '160px' },
  { label: 'M', value: 256, desc: '256px' },
  { label: 'L', value: 400, desc: '400px' },
  { label: 'XL', value: 600, desc: '600px' },
]

function App() {
  const [items, setItems] = useState<QRItem[]>(() => {
    const saved = localStorage.getItem('qr-items')
    if (saved) {
      try {
        return JSON.parse(saved).map((p: QRItem) => ({ ...p, dataUrl: undefined }))
      } catch { /* ignore */ }
    }
    return [{ id: generateId(), label: '', content: '' }]
  })

  const [color, setColor] = useState('#1e293b')
  const [sizeIdx, setSizeIdx] = useState(1)
  const [csvMode, setCsvMode] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const toSave = items.map(({ dataUrl, ...rest }) => rest)
    localStorage.setItem('qr-items', JSON.stringify(toSave))
  }, [items])

  useEffect(() => {
    const size = SIZES[sizeIdx].value
    items.forEach(async (item) => {
      if (item.content.trim()) {
        const url = await generateQR(item, color, size)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, dataUrl: url } : i))
      }
    })
  }, [items.map(i => i.content).join('|||'), color, sizeIdx])

  const updateItem = (id: string, field: 'label' | 'content', value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const addItem = () => {
    setItems(prev => [...prev, { id: generateId(), label: '', content: '' }])
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  }

  const clearAll = () => {
    setItems([{ id: generateId(), label: '', content: '' }])
    localStorage.removeItem('qr-items')
  }

  const parseCSV = useCallback(() => {
    const lines = csvText.trim().split('\n')
    const newItems: QRItem[] = []
    for (const line of lines) {
      const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',')
      const label = (parts[0] || '').trim()
      const content = (parts[1] || parts[0] || '').trim()
      if (content) {
        newItems.push({ id: generateId(), label, content })
      }
    }
    if (newItems.length > 0) {
      setItems(newItems)
      setCsvMode(false)
      setCsvText('')
    }
  }, [csvText])

  const triggerSuccess = () => {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  const downloadAllPNG = async () => {
    setDownloading(true)
    try {
      for (const item of items) {
        if (!item.content.trim()) continue
        const url = await generateQR(item, color, 800)
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.label || item.content.slice(0, 30)}.png`
        a.click()
      }
      triggerSuccess()
    } finally { setDownloading(false) }
  }

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const validItems = items.filter(i => i.content.trim())
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const cols = 3
      const cellW = (pageW - margin * 2) / cols
      const qrSize = 40
      const cellH = 55

      let idx = 0
      let col = 0
      let row = 0

      for (const item of validItems) {
        if (row * cellH + cellH > pageH - margin && idx > 0) {
          pdf.addPage()
          col = 0
          row = 0
        }
        const x = margin + col * cellW
        const y = margin + row * cellH
        const qrUrl = await generateQR(item, color, 400)
        pdf.addImage(qrUrl, 'PNG', x + (cellW - qrSize) / 2, y + 2, qrSize, qrSize)
        const label = item.label || normalizeContent(item.content).slice(0, 30)
        pdf.setFontSize(8)
        pdf.text(label, x + cellW / 2, y + qrSize + 10, { align: 'center' })
        col++
        if (col >= cols) { col = 0; row++ }
        idx++
      }
      pdf.save('qrcodes.pdf')
      triggerSuccess()
    } finally { setDownloading(false) }
  }

  const validCount = items.filter(i => i.content.trim()).length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <QrCode className="h-5 w-5" strokeWidth={2} />
            </span>
            <h1 className="text-lg font-semibold tracking-tight">QR 批量生成器</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCsvMode(!csvMode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300">
              {csvMode ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">{csvMode ? '取消' : 'CSV 导入'}</span>
            </button>
            <button onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">清空</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <Sparkles className="h-3.5 w-3.5" /> 纯前端 · 无需登录
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              批量生成二维码，<span className="text-blue-600">一键导出</span>
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              支持自定义颜色与尺寸，CSV 批量导入，导出 PNG 或 PDF 排版打印。
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Settings Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">颜色</span>
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button key={c.value} onClick={() => setColor(c.value)}
                  title={c.name}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${color === c.value ? 'border-blue-500 scale-110 ring-2 ring-blue-200' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.value }} />
              ))}
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Maximize className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">尺寸</span>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {SIZES.map((s, i) => (
                <button key={i} onClick={() => setSizeIdx(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${sizeIdx === i ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {validCount > 0 && (
            <>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Zap className="h-4 w-4 text-amber-500" />
                已生成 {validCount} 个
              </div>
            </>
          )}
        </div>

        {/* CSV Mode */}
        {csvMode && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/30 p-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" /> 批量导入
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              每行一条，逗号或 Tab 分隔。<code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono border">名称,链接</code> 或仅输入内容
            </p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={"张三,https://example.com/zhangsan\n李四,https://example.com/lisi\n王五,WIFI:T:WPA;S:MyWiFi;P:password;;"}
              className="mt-3 w-full h-40 rounded-xl border border-slate-200 bg-white p-3 text-sm font-mono resize-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
            />
            <button onClick={parseCSV}
              disabled={!csvText.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
              <ArrowRight className="h-4 w-4" /> 生成二维码
            </button>
          </div>
        )}

        {/* QR Items */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id}
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex sm:items-start sm:gap-5"
              style={{ animation: `fadeIn 0.3s ease-out ${idx * 0.05}s both` }}>
              {/* QR Preview */}
              <div className="mx-auto mb-3 flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-100 sm:mx-0 sm:mb-0">
                {item.dataUrl ? (
                  <img src={item.dataUrl} alt="QR" className="h-28 w-28 object-contain rounded" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <QrCode className="h-10 w-10" strokeWidth={1} />
                    <span className="text-[10px]">输入内容预览</span>
                  </div>
                )}
              </div>

              {/* Inputs */}
              <div className="flex-1 space-y-2">
                <input
                  value={item.label}
                  onChange={e => updateItem(item.id, 'label', e.target.value)}
                  placeholder="标签名称（可选）"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
                />
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={item.content}
                    onChange={e => updateItem(item.id, 'content', e.target.value)}
                    placeholder="输入链接或文本内容..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-4 text-sm placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
                  />
                </div>
              </div>

              {/* Delete */}
              <button onClick={() => removeItem(item.id)}
                className="mt-2 mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition sm:mt-0 sm:mx-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Button */}
        <button onClick={addItem}
          className="mt-4 w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-medium text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50/30 hover:text-blue-600">
          <Plus className="mr-1.5 inline h-5 w-5" /> 添加一条
        </button>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <QrCode className="h-4 w-4" />
            <span>QR 批量生成器 · 纯前端，数据仅保存在本地</span>
          </div>
        </div>
      </footer>

      {/* Floating Action Bar */}
      {validCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-3 shadow-xl backdrop-blur-md">
            <button onClick={downloadAllPNG} disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:opacity-50">
              <Download className="h-4 w-4" /> 下载 PNG
            </button>
            <button onClick={downloadPDF} disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:opacity-50">
              <FileText className="h-4 w-4" /> 导出 PDF
            </button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 shadow-lg">
            <Sparkles className="h-4 w-4" /> 导出成功！
          </div>
        </div>
      )}
    </div>
  )
}

export default App
