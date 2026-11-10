import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../app/contexto'
import { SeletorMes } from './ui'

export function Cabecalho({ titulo, comMes = true, extra }: { titulo: string; comMes?: boolean; extra?: ReactNode }) {
  const { mes, setMes, editar } = useApp()
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
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
