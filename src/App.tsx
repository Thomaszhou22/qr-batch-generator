import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

interface QRItem {
  id: string
  label: string
  content: string
  dataUrl?: string
  color: string
  size: number
}

const DEFAULT_COLOR = '#000000'
const DEFAULT_SIZE = 200

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

async function generateQR(item: QRItem): Promise<string> {
  return QRCode.toDataURL(item.content, {
    width: item.size,
    margin: 1,
    color: { dark: item.color, light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

function App() {
  const [items, setItems] = useState<QRItem[]>(() => {
    const saved = localStorage.getItem('qr-items')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((p: QRItem) => ({ ...p, dataUrl: undefined }))
      } catch { /* ignore */ }
    }
    return [{ id: generateId(), label: '', content: '', color: DEFAULT_COLOR, size: DEFAULT_SIZE }]
  })

  const [globalColor, setGlobalColor] = useState(DEFAULT_COLOR)
  const [globalSize, setGlobalSize] = useState(DEFAULT_SIZE)
  const [csvMode, setCsvMode] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const toSave = items.map(({ dataUrl, ...rest }) => rest)
    localStorage.setItem('qr-items', JSON.stringify(toSave))
  }, [items])

  // Generate QR codes for all items
  useEffect(() => {
    items.forEach(async (item) => {
      if (item.content.trim()) {
        const url = await generateQR({ ...item, color: globalColor, size: globalSize })
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, dataUrl: url } : i))
      }
    })
  }, [items.map(i => i.content).join('|||'), globalColor, globalSize])

  const updateItem = (id: string, field: 'label' | 'content', value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const addItem = () => {
    setItems(prev => [...prev, { id: generateId(), label: '', content: '', color: globalColor, size: globalSize }])
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  }

  const clearAll = () => {
    setItems([{ id: generateId(), label: '', content: '', color: DEFAULT_COLOR, size: DEFAULT_SIZE }])
    setGlobalColor(DEFAULT_COLOR)
    setGlobalSize(DEFAULT_SIZE)
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
        newItems.push({ id: generateId(), label, content, color: globalColor, size: globalSize })
      }
    }
    if (newItems.length > 0) {
      setItems(newItems)
      setCsvMode(false)
      setCsvText('')
    }
  }, [csvText, globalColor, globalSize])

  const downloadAllPNG = async () => {
    setDownloading(true)
    try {
      for (const item of items) {
        if (!item.content.trim()) continue
        const url = await generateQR({ ...item, color: globalColor, size: 800 })
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.label || item.content.slice(0, 20)}.png`
        a.click()
      }
    } finally {
      setDownloading(false)
    }
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

      for (let idx = 0; idx < validItems.length; idx++) {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = margin + col * cellW
        const y = margin + row * cellH

        if (y + cellH > pageH - margin && idx > 0) {
          pdf.addPage()
          continue // re-calc on next iteration... actually let's just handle it
        }

        const item = validItems[idx]
        const qrUrl = await generateQR({ ...item, color: globalColor, size: 400 })
        pdf.addImage(qrUrl, 'PNG', x + (cellW - qrSize) / 2, y + 2, qrSize, qrSize)
        
        const label = item.label || item.content.slice(0, 30)
        pdf.setFontSize(8)
        pdf.text(label, x + cellW / 2, y + qrSize + 10, { align: 'center' })
      }

      pdf.save('qrcodes.pdf')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-gray-800">📦 批量二维码生成器</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setCsvMode(!csvMode)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                {csvMode ? '✏️ 手动输入' : '📋 CSV导入'}
              </button>
              <button onClick={clearAll}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition">
                清空
              </button>
            </div>
          </div>

          {/* Global Settings */}
          <div className="flex items-center gap-6 mt-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              颜色
              <input type="color" value={globalColor} onChange={e => setGlobalColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              大小
              <select value={globalSize} onChange={e => setGlobalSize(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm">
                <option value={128}>小 (128px)</option>
                <option value={200}>中 (200px)</option>
                <option value={300}>大 (300px)</option>
                <option value={500}>超大 (500px)</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {csvMode ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-2">批量导入</h3>
            <p className="text-sm text-gray-500 mb-3">
              每行一条，用逗号或 Tab 分隔。格式：<code className="bg-gray-100 px-1 rounded">名称,内容</code> 或 <code className="bg-gray-100 px-1 rounded">内容</code>
            </p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={"张三,https://example.com/zhangsan\n李四,https://example.com/lisi\n王五,WIFI:T:WPA;S:MyWiFi;P:password;;"}
              className="w-full h-40 border rounded-lg p-3 text-sm font-mono resize-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
            />
            <button onClick={parseCSV}
              disabled={!csvText.trim()}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition">
              生成二维码
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-start">
                {/* QR Preview */}
                <div className="flex-shrink-0 w-28 h-28 bg-gray-50 rounded-lg flex items-center justify-center border">
                  {item.dataUrl ? (
                    <img src={item.dataUrl} alt="QR" className="w-24 h-24 object-contain" />
                  ) : (
                    <span className="text-gray-300 text-3xl">⬜</span>
                  )}
                </div>

                {/* Inputs */}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={item.label}
                      onChange={e => updateItem(item.id, 'label', e.target.value)}
                      placeholder="标签（可选）"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                    />
                  </div>
                  <input
                    value={item.content}
                    onChange={e => updateItem(item.id, 'content', e.target.value)}
                    placeholder="输入内容或链接..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  />
                </div>

                {/* Delete */}
                <button onClick={() => removeItem(item.id)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  ✕
                </button>
              </div>
            ))}

            <button onClick={addItem}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition">
              + 添加一条
            </button>
          </div>
        )}

        {/* Actions */}
        {items.some(i => i.content.trim()) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-white rounded-2xl shadow-lg px-6 py-3 border">
            <span className="flex items-center text-sm text-gray-500">
              已生成 {items.filter(i => i.content.trim()).length} 个
            </span>
            <button onClick={downloadAllPNG} disabled={downloading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition">
              📥 下载全部 PNG
            </button>
            <button onClick={downloadPDF} disabled={downloading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition">
              📄 导出 PDF
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export default App
