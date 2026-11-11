/**
 * Caixas de confirmação e avisos do próprio app (no lugar de window.confirm / window.alert).
 *
 *   if (await confirmar({ titulo: 'Excluir?', mensagem: '...', acao: 'Excluir', perigo: true })) { ... }
 *   avisar('Backup restaurado!')            // aviso verde que some sozinho
 *   avisar('Arquivo inválido', 'erro')
 */
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, X, XCircle } from 'lucide-react'

interface OpcoesConfirmar {
  titulo: string
  mensagem?: ReactNode
  acao?: string // texto do botão de confirmar
  cancelar?: string
  perigo?: boolean // botão vermelho, para ações destrutivas
}

interface Pedido extends OpcoesConfirmar { responder: (ok: boolean) => void }
interface Aviso { id: number; texto: ReactNode; tipo: 'sucesso' | 'erro' }

let pedido: Pedido | null = null
let avisos: Aviso[] = []
let proxId = 1
const ouvintes = new Set<() => void>()
const notificar = () => ouvintes.forEach((f) => f())
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }

export function confirmar(opcoes: OpcoesConfirmar): Promise<boolean> {
  pedido?.responder(false)
  return new Promise((resolve) => {
    pedido = { ...opcoes, responder: (ok) => { pedido = null; notificar(); resolve(ok) } }
    notificar()
  })
}

export function avisar(texto: ReactNode, tipo: Aviso['tipo'] = 'sucesso') {
  const id = proxId++
  avisos = [...avisos, { id, texto, tipo }]
  notificar()
  setTimeout(() => fecharAviso(id), tipo === 'erro' ? 6000 : 3500)
}

function fecharAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id)
  notificar()
}

/** Montado uma vez no App. */
export function Dialogos() {
  const p = useSyncExternalStore(assinar, () => pedido)
  const lista = useSyncExternalStore(assinar, () => avisos)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!p) return
    botao.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') p.responder(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [p])

  return (
    <>
      {p && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-[aparecer_.12s_ease-out]"
          onMouseDown={(e) => e.target === e.currentTarget && p.responder(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.perigo ? 'bg-rose-500/15 text-rose-600' : 'bg-[var(--accent)]/15 text-accent'}`}>
                {p.perigo ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="dlg-titulo" className="font-semibold">{p.titulo}</h2>
                {p.mensagem && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.mensagem}</div>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => p.responder(false)}>{p.cancelar ?? 'Cancelar'}</button>
              <button ref={botao} className={p.perigo ? 'btn-danger' : 'btn-primary'} onClick={() => p.responder(true)}>{p.acao ?? 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        {lista.map((a) => (
          <div key={a.id} role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg animate-[aparecer_.15s_ease-out] dark:border-slate-700 dark:bg-slate-800">
            {a.tipo === 'erro' ? <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />}
            <div className="flex-1">{a.texto}</div>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => fecharAviso(a.id)} aria-label="Fechar aviso"><X size={16} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
