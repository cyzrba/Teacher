/**
 * 前端文件导出工具。
 *
 * 当前无后端，成绩 / 过程 / 技能三类报表由前端组装 CSV 直接下载；
 * 后端就绪后改为请求 GET /exports/{type} 取回文件流即可，页面调用方式不变。
 */

/** 生成带 BOM 的 CSV 文本，Excel 打开不乱码 */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [header, ...rows].map((line) => line.map(escape).join(',')).join('\r\n')
}

/** 触发浏览器下载 */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([`\uFEFF${content}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** 生成带日期的文件名 */
export function datedName(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`
}
