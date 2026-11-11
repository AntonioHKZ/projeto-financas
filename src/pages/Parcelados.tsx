import { useMemo } from 'react'
import { Pencil, Trash2, TrendingDown } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { Barra, BadgeCategoria, Vazio } from '../components/ui'
import { addMes, diffMes, mesDe, moeda, nomeMes } from '../lib/format'
import { isPagoMapa, ultimoMes } from '../lib/mes'
import { db } from '../lib/db'
import { confirmar } from '../components/Dialogos'
import type { Dados, Parcelado } from '../lib/types'

function info(p: Parcelado) {
  let pagas = 0
  for (let k = 0; k < p.parcelas; k++) if (isPagoMapa(p.pagos, addMes(p.primeiroMes, k))) pagas++
  const restantes = p.parcelas - pagas
  return { pagas, restantes, restante: restantes * p.valorParcela, fim: ultimoMes(p) }
}

export default function Parcelados({ dados }: { dados: Dados }) {
  const { editar } = useApp()
  const hoje = mesDe()
  const lista = useMemo(() => dados.parcelados.map((p) => ({ p, ...info(p) })).sort((a, b) => a.fim.localeCompare(b.fim)), [dados.parcelados])
  const ativos = lista.filter((x) => x.restantes > 0)
  const quitados = lista.filter((x) => x.restantes === 0)
  const totalRestante = ativos.reduce((s, x) => s + x.restante, 0)
  const mensalAtual = dados.parcelados.filter((p) => diffMes(p.primeiroMes, hoje) >= 0 && diffMes(hoje, ultimoMes(p)) >= 0).reduce((s, p) => s + p.valorParcela, 0)

  const alivio = useMemo(() => {
    const m = new Map<string, { valor: number; nomes: string[] }>()
    for (const p of dados.parcelados) {
      const fim = ultimoMes(p)
      if (diffMes(hoje, fim) < 0) continue
      const mesAlivio = addMes(fim, 1)
      const e = m.get(mesAlivio) ?? { valor: 0, nomes: [] }
      e.valor += p.valorParcela
      e.nomes.push(p.descricao)
      m.set(mesAlivio, e)
    }
    let acumulado = 0
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, e]) => ({ mes, ...e, acumulado: (acumulado += e.valor) }))
  }, [dados.parcelados, hoje])

  const Linha = ({ x }: { x: (typeof lista)[number] }) => (
    <li className="card group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{x.p.descricao}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <BadgeCategoria cat={dados.categorias.find((c) => c.id === x.p.categoriaId)} />
            <span>{dados.contas.find((c) => c.id === x.p.contaId)?.nome}</span>
          </div>
        </div>
        <div className="flex shrink-0">
          <button className="btn-ghost !p-1.5" onClick={() => editar({ tipo: 'parcelado', item: x.p })}><Pencil size={15} /></button>
          <button className="btn-ghost !p-1.5 hover:!text-rose-500" onClick={async () => (await confirmar({ titulo: `Excluir ${x.p.descricao}?`, mensagem: `Todas as ${x.p.parcelas} parcelas saem do app.`, acao: 'Excluir', perigo: true })) && db.parcelados.delete(x.p.id)}><Trash2 size={15} /></button>
        </div>
      </div>
      <div className="mt-3 mb-1 flex justify-between text-sm">
        <span><b>{x.pagas}/{x.p.parcelas}</b> pagas · {x.p.parcelas}x de {moeda(x.p.valorParcela)}</span>
        <span className="text-slate-500">termina em {nomeMes(x.fim, true)}</span>
      </div>
      <Barra pct={(x.pagas / x.p.parcelas) * 100} />
      <div className="mt-2 text-sm">Falta pagar: <b>{moeda(x.restante)}</b></div>
    </li>
  )

  return (
    <div>
      <Cabecalho titulo="Parcelados" comMes={false} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="text-sm text-slate-500">Total ainda a pagar</div><div className="mt-1 text-2xl font-bold">{moeda(totalRestante)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Parcelas neste mês</div><div className="mt-1 text-2xl font-bold">{moeda(mensalAtual)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Compras ativas</div><div className="mt-1 text-2xl font-bold">{ativos.length}</div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {ativos.length === 0 ? <Vazio>Nenhuma compra parcelada em andamento.</Vazio> : <ul className="grid gap-3 md:grid-cols-2">{ativos.map((x) => <Linha key={x.p.id} x={x} />)}</ul>}
          {quitados.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-500">Quitados ({quitados.length})</summary>
              <ul className="mt-3 grid gap-3 opacity-70 md:grid-cols-2">{quitados.map((x) => <Linha key={x.p.id} x={x} />)}</ul>
            </details>
          )}
        </div>
        <div className="card h-fit">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><TrendingDown size={18} className="text-emerald-500" /> Alívio no orçamento</h2>
          <p className="mb-3 text-xs text-slate-500">Quando as parcelas acabam e quanto o gasto mensal cai.</p>
          {alivio.length === 0 ? <p className="text-sm text-slate-500">Sem parcelas terminando.</p> : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-700">
              {alivio.map((a) => (
                <li key={a.mes}>
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-500" />
                  <div className="text-sm font-semibold">{nomeMes(a.mes)}</div>
                  <div className="text-sm text-emerald-600">−{moeda(a.valor)}/mês <span className="text-xs text-slate-500">(total liberado: {moeda(a.acumulado)})</span></div>
                  <div className="text-xs text-slate-500">{a.nomes.join(', ')}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
