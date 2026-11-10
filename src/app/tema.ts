export const CORES_DESTAQUE = ['#8b5cf6', '#820ad1', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899']

function ler(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function gravar(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ }
}

export function temaAtual(): 'claro' | 'escuro' {
  const t = ler('tema')
  if (t === 'claro' || t === 'escuro') return t
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export function aplicarTema(t: 'claro' | 'escuro', salvar = true) {
  document.documentElement.classList.toggle('dark', t === 'escuro')
  if (salvar) gravar('tema', t)
}

export function destaqueAtual(): string {
  return ler('destaque') ?? CORES_DESTAQUE[0]
}

export function aplicarDestaque(cor: string, salvar = true) {
  document.documentElement.style.setProperty('--accent', cor)
  if (salvar) gravar('destaque', cor)
}

export function iniciarTema() {
  aplicarTema(temaAtual(), false)
  aplicarDestaque(destaqueAtual(), false)
}
