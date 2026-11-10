import { useEffect, type ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Categoria, Conta, Mes } from '../lib/types'
import { addMes, mesDe, nomeMes } from '../lib/format'

export function Modal({ titulo, aberto, fechar, children, largo }: { titulo: string; aberto: boolean; fechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    if (!aberto) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [aberto, fechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl ${largo ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="btn-ghost !p-1.5" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function SeletorMes({ mes, setMes }: { mes: Mes; setMes: (m: Mes) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
      <button className="btn-ghost !p-1.5" onClick={() => setMes(addMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
      <button className="min-w-36 text-center text-sm font-semibold" onClick={() => setMes(mesDe())} title="Voltar para o mês atual">
        {nomeMes(mes)}
      </button>
      <button className="btn-ghost !p-1.5" onClick={() => setMes(addMes(mes, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
    </div>
  )
}

export function SelectCategoria({ categorias, value, onChange, vazio = 'Sem categoria' }: { categorias: Categoria[]; value?: string; onChange: (v: string) => void; vazio?: string }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vazio}</option>
      {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
    </select>
  )
}

export function SelectConta({ contas, value, onChange, vazio = 'Sem conta' }: { contas: Conta[]; value?: string; onChange: (v: string) => void; vazio?: string }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vazio}</option>
      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  )
}

export function BadgeCategoria({ cat }: { cat?: Categoria }) {
  if (!cat) return <span className="text-xs text-slate-400">—</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: cat.cor + '22', color: cat.cor }}>
      {cat.emoji} {cat.nome}
    </span>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{children}</div>
}

export function Barra({ pct, cor }: { pct: number; cor?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: cor ?? 'var(--accent)' }} />
    </div>
  )
}
