import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock, Check } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { Barra, Vazio } from '../components/ui'
import { gerarMes, resumo } from '../lib/mes'
import { addMes, dataBR, moeda, nomeMes } from '../lib/format'
import { alternarPago } from '../lib/acoes'
import type { Dados } from '../lib/types'

const COR_GRUPO = { parcelas: '#f59e0b', fixas: '#6366f1', avulsos: '#0ea5e9' }

export default function Painel({ dados }: { dados: Dados }) {
  const { mes, setMes, ir } = useApp()
  const itens = useMemo(() => gerarMes(mes, dados), [mes, dados])
  const r = resumo(itens)
  const catDe = (id?: string) => dados.categorias.find((c) => c.id === id)

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of itens) if (i.tipo === 'despesa') m.set(i.categoriaId ?? '', (m.get(i.categoriaId ?? '') ?? 0) + i.valor)
    return [...m.entries()].map(([id, valor]) => {
      const c = catDe(id)
      return { id, nome: c ? `${c.emoji} ${c.nome}` : 'Sem categoria', valor, cor: c?.cor ?? '#94a3b8' }
    }).sort((a, b) => b.valor - a.valor)
  }, [itens, dados.categorias])

  const projecao = useMemo(() => Array.from({ length: 12 }, (_, k) => {
    const m = addMes(mes, k)
    const its = gerarMes(m, dados)
    const soma = (g: string) => its.filter((i) => i.tipo === 'despesa' && i.grupo === g).reduce((s, i) => s + i.valor, 0)
    return { mes: m, rotulo: nomeMes(m, true), parcelas: soma('parcelas'), fixas: soma('fixas'), avulsos: soma('avulsos'), receita: its.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0) }
  }), [mes, dados])

  const proximos = useMemo(() => {
    const prox = gerarMes(addMes(mes, 1), dados)
    return [...itens, ...prox].filter((i) => i.tipo === 'despesa' && !i.pago).slice(0, 8)
  }, [itens, mes, dados])

  const orcamentos = dados.categorias.filter((c) => c.limite).map((c) => ({
    c, gasto: itens.filter((i) => i.tipo === 'despesa' && i.categoriaId === c.id).reduce((s, i) => s + i.valor, 0),
  }))

  const cards = [
    { nome: 'Receitas', valor: r.receitas, Icone: ArrowUpCircle, cor: 'text-emerald-500' },
    { nome: 'Despesas', valor: r.despesas, Icone: ArrowDownCircle, cor: 'text-rose-500' },
    { nome: 'Saldo previsto', valor: r.saldo, Icone: Wallet, cor: r.saldo >= 0 ? 'text-emerald-500' : 'text-rose-500' },
    { nome: 'Ainda a pagar', valor: r.aPagar, Icone: Clock, cor: 'text-amber-500' },
  ]

  return (
    <div>
      <Cabecalho titulo="Painel" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ nome, valor, Icone, cor }) => (
          <div key={nome} className="card">
            <div className="flex items-center justify-between text-sm text-slate-500"><span>{nome}</span><Icone size={18} className={cor} /></div>
            <div className={`mt-2 text-xl font-bold sm:text-2xl ${nome === 'Saldo previsto' ? cor : ''}`}>{moeda(valor)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">Despesas por categoria</h2>
          {porCategoria.length === 0 ? <Vazio>Nenhuma despesa neste mês.</Vazio> : (
            <>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="valor" nameKey="nome" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none"
                      onClick={(_, i) => ir('extrato', { categoriaId: porCategoria[i]?.id || undefined })} className="cursor-pointer">
                      {porCategoria.map((p) => <Cell key={p.id} fill={p.cor} />)}
                    </Pie>
                    <Tooltip formatter={(v) => moeda(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {porCategoria.map((p) => (
                  <li key={p.id}>
                    <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => ir('extrato', { categoriaId: p.id || undefined })}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />
                      <span className="flex-1 text-left">{p.nome}</span>
                      <span className="font-medium">{moeda(p.valor)}</span>
                      <span className="w-10 text-right text-xs text-slate-500">{Math.round((p.valor / r.despesas) * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card lg:col-span-3">
          <h2 className="mb-1 font-semibold">Projeção dos próximos 12 meses</h2>
          <p className="mb-2 text-xs text-slate-500">Clique em um mês para abrir o extrato dele.</p>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={projecao} className="cursor-pointer"
                onClick={(e: any) => { const i = Number(e?.activeTooltipIndex ?? e?.activeIndex); if (projecao[i]) { setMes(projecao[i].mes); ir('extrato') } }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                <XAxis dataKey="rotulo" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={32} />
                <Tooltip formatter={(v) => moeda(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="parcelas" name="Parcelas" stackId="d" fill={COR_GRUPO.parcelas} />
                <Bar dataKey="fixas" name="Assinaturas e fixas" stackId="d" fill={COR_GRUPO.fixas} />
                <Bar dataKey="avulsos" name="Avulsos" stackId="d" fill={COR_GRUPO.avulsos} radius={[4, 4, 0, 0]} />
                <Line dataKey="receita" name="Receita" stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Orçamento por categoria</h2>
          {orcamentos.length === 0 ? <Vazio>Defina limites mensais nas categorias em <button className="text-accent underline" onClick={() => ir('personalizar')}>Personalizar</button>.</Vazio> : (
            <ul className="space-y-3">
              {orcamentos.map(({ c, gasto }) => {
                const pct = (gasto / c.limite!) * 100
                return (
                  <li key={c.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c.emoji} {c.nome}</span>
                      <span className={pct > 100 ? 'font-semibold text-rose-500' : 'text-slate-500'}>{moeda(gasto)} / {moeda(c.limite!)}</span>
                    </div>
                    <Barra pct={pct} cor={pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : c.cor} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Próximos vencimentos</h2>
          {proximos.length === 0 ? <Vazio>Tudo pago por aqui 🎉</Vazio> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {proximos.map((i) => (
                <li key={i.key} className="flex items-center gap-3 py-2 text-sm">
                  <button title="Marcar como pago" onClick={() => alternarPago(i, i.data.slice(0, 7))}
                    className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 hover:border-[var(--accent)] dark:border-slate-600">
                    <Check size={12} className="opacity-0 hover:opacity-50" />
                  </button>
                  <span className="w-14 text-slate-500">{dataBR(i.data).slice(0, 5)}</span>
                  <span className="flex-1 truncate">{catDe(i.categoriaId)?.emoji} {i.descricao} {i.parcelaInfo && <span className="text-xs text-slate-500">({i.parcelaInfo})</span>}</span>
                  <span className="font-medium">{moeda(i.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
