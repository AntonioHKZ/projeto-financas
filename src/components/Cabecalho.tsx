import type { ReactNode } from 'react'
import { Plus, Landmark } from 'lucide-react'
import { useApp } from '../app/contexto'
import { SeletorMes } from './ui'

export function Cabecalho({ titulo, comMes = true, comVisao = true, extra }: { titulo: string; comMes?: boolean; comVisao?: boolean; extra?: ReactNode }) {
  const { mes, setMes, editar, visao, setVisao, opcoesVisao } = useApp()
  const atual = opcoesVisao.find((o) => o.id === visao)
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {comVisao && opcoesVisao.length >= 2 && (
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-3 pr-1 dark:border-slate-800 dark:bg-slate-900" title="Mostrar só um banco">
            <Landmark size={16} style={{ color: atual?.cor }} className={atual ? '' : 'text-slate-400'} />
            <select className="cursor-pointer bg-transparent py-1 pr-1 text-sm font-semibold outline-none dark:[color-scheme:dark]" value={visao} onChange={(e) => setVisao(e.target.value)} aria-label="Visão por banco">
              <option value="">Todos os bancos</option>
              {opcoesVisao.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </label>
        )}
        {comMes && <SeletorMes mes={mes} setMes={setMes} />}
        <div className="hidden gap-1 lg:flex">
          <button className="btn-outline" onClick={() => editar({ tipo: 'lancamento' })}><Plus size={14} /> Lançamento</button>
          <button className="btn-outline" onClick={() => editar({ tipo: 'parcelado' })}><Plus size={14} /> Parcelado</button>
          <button className="btn-outline" onClick={() => editar({ tipo: 'recorrente' })}><Plus size={14} /> Recorrente</button>
        </div>
      </div>
    </div>
  )
}
