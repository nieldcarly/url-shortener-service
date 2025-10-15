export function formatBytes(n: number) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
