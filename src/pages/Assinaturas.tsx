import { Pencil, Trash2, Plus, Ban, RotateCcw } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { BadgeCategoria, Vazio } from '../components/ui'
import { diffMes, mesDe, moeda, nomeMes } from '../lib/format'
import { custoMensal } from '../lib/mes'
import { db } from '../lib/db'
import type { Dados, Recorrente, TipoRecorrente } from '../lib/types'

const SECOES: { tipo: TipoRecorrente; titulo: string; emoji: string }[] = [
  { tipo: 'assinatura', titulo: 'Assinaturas', emoji: '📺' },
  { tipo: 'fixa', titulo: 'Contas fixas', emoji: '🧾' },
  { tipo: 'receita', titulo: 'Receitas fixas', emoji: '💼' },
]

export default function Assinaturas({ dados }: { dados: Dados }) {
  const { editar } = useApp()
  const hoje = mesDe()
  const ativa = (r: Recorrente) => !r.fim || diffMes(hoje, r.fim) >= 0

  const cancelar = (r: Recorrente) => db.recorrentes.update(r.id, { fim: hoje })
  const reativar = (r: Recorrente) => db.recorrentes.update(r.id, { fim: undefined })

  return (
    <div>
      <Cabecalho titulo="Assinaturas e fixas" comMes={false} />
      <div className="space-y-6">
        {SECOES.map((s) => {
          const lista = dados.recorrentes.filter((r) => r.tipo === s.tipo).sort((a, b) => Number(ativa(b)) - Number(ativa(a)) || b.valor - a.valor)
          const ativas = lista.filter(ativa)
          const mensal = ativas.reduce((t, r) => t + custoMensal(r), 0)
          return (
            <section key={s.tipo}>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-lg font-semibold">{s.emoji} {s.titulo}</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span>Mensal: <b>{moeda(mensal)}</b></span>
                  <span>Anual: <b>{moeda(mensal * 12)}</b></span>
                  <button className="btn-outline !py-1" onClick={() => editar({ tipo: 'recorrente', tipoRecorrente: s.tipo })}><Plus size={14} /> Adicionar</button>
                </div>
              </div>
              {lista.length === 0 ? <Vazio>Nenhum item.</Vazio> : (
                <ul className="card !p-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {lista.map((r) => {
                    const on = ativa(r)
                    return (
                      <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${on ? '' : 'opacity-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{r.descricao} {!on && <span className="ml-1 rounded bg-slate-500/15 px-1.5 text-xs">cancelada em {nomeMes(r.fim!, true)}</span>}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <BadgeCategoria cat={dados.categorias.find((c) => c.id === r.categoriaId)} />
                            <span>dia {r.dia} · {r.frequencia === 'anual' ? `anual (${nomeMes(r.inicio).split(' ')[0].toLowerCase()})` : 'mensal'}</span>
                            <span>{dados.contas.find((c) => c.id === r.contaId)?.nome}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${s.tipo === 'receita' ? 'text-emerald-600' : ''}`}>{moeda(r.valor)}</div>
                          <div className="text-xs text-slate-500">{r.frequencia === 'anual' ? `${moeda(r.valor / 12)}/mês` : `${moeda(r.valor * 12)}/ano`}</div>
                        </div>
                        <div className="flex">
                          {on
                            ? <button className="btn-ghost !p-1.5" title="Cancelar (para de cobrar a partir do mês que vem)" onClick={() => cancelar(r)}><Ban size={15} /></button>
                            : <button className="btn-ghost !p-1.5" title="Reativar" onClick={() => reativar(r)}><RotateCcw size={15} /></button>}
                          <button className="btn-ghost !p-1.5" title="Editar" onClick={() => editar({ tipo: 'recorrente', item: r })}><Pencil size={15} /></button>
                          <button className="btn-ghost !p-1.5 hover:!text-rose-500" title="Excluir de todos os meses" onClick={() => confirm(`Excluir "${r.descricao}" de todos os meses?`) && db.recorrentes.delete(r.id)}><Trash2 size={15} /></button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
