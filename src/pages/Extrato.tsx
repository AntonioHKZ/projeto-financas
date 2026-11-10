import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Trash2, Search, X } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { BadgeCategoria, SelectCategoria, SelectConta, Vazio } from '../components/ui'
import { gerarMes, resumo } from '../lib/mes'
import { dataBR, moeda, normalizar } from '../lib/format'
import { alternarPago, excluirItem } from '../lib/acoes'
import type { Dados, ItemMes } from '../lib/types'

export default function Extrato({ dados }: { dados: Dados }) {
  const { mes, filtrosIniciais, editar } = useApp()
  const [busca, setBusca] = useState('')
  const [categoriaId, setCategoriaId] = useState(filtrosIniciais.categoriaId ?? '')
  const [contaId, setContaId] = useState(filtrosIniciais.contaId ?? '')
  const [status, setStatus] = useState<'' | 'pago' | 'pendente'>('')
  const [tipo, setTipo] = useState<'' | 'despesa' | 'receita'>('')

  useEffect(() => {
    setCategoriaId(filtrosIniciais.categoriaId ?? '')
    setContaId(filtrosIniciais.contaId ?? '')
  }, [filtrosIniciais])

  const todos = useMemo(() => gerarMes(mes, dados), [mes, dados])
  const itens = useMemo(() => {
    const q = normalizar(busca)
    return todos.filter((i) =>
      (!q || normalizar(i.descricao).includes(q)) &&
      (!categoriaId || (i.categoriaId ?? '') === categoriaId) &&
      (!contaId || (i.contaId ?? '') === contaId) &&
      (!status || (status === 'pago') === i.pago) &&
      (!tipo || i.tipo === tipo))
  }, [todos, busca, categoriaId, contaId, status, tipo])

  const grupos = useMemo(() => {
    const m = new Map<string, ItemMes[]>()
    for (const i of itens) m.set(i.contaId ?? '', [...(m.get(i.contaId ?? '') ?? []), i])
    return [...m.entries()].map(([id, its]) => ({ conta: dados.contas.find((c) => c.id === id), id, itens: its }))
      .sort((a, b) => (a.conta?.nome ?? 'zzz').localeCompare(b.conta?.nome ?? 'zzz'))
  }, [itens, dados.contas])

  const r = resumo(itens)
  const temFiltro = busca || categoriaId || contaId || status || tipo

  const abrirEdicao = (i: ItemMes) => {
    if (i.origem === 'avulso') editar({ tipo: 'lancamento', item: dados.lancamentos.find((l) => l.id === i.refId) })
    else if (i.origem === 'parcela') editar({ tipo: 'parcelado', item: dados.parcelados.find((p) => p.id === i.refId) })
    else editar({ tipo: 'recorrente', item: dados.recorrentes.find((x) => x.id === i.refId) })
  }

  const excluir = async (i: ItemMes) => {
    const msg = i.origem === 'avulso' ? `Excluir "${i.descricao}"?`
      : i.origem === 'parcela' ? `Isto exclui a compra parcelada "${i.descricao}" inteira (todas as parcelas). Continuar?`
      : `Isto exclui "${i.descricao}" de todos os meses. Para só parar a cobrança, use "Cancelar" em Assinaturas. Continuar?`
    if (confirm(msg)) await excluirItem(i)
  }

  return (
    <div>
      <Cabecalho titulo="Extrato do mês" />

      <div className="card mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input !pl-9" placeholder="Buscar descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <SelectCategoria categorias={dados.categorias} value={categoriaId} onChange={setCategoriaId} vazio="Todas as categorias" />
        <SelectConta contas={dados.contas} value={contaId} onChange={setContaId} vazio="Todas as contas" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="">Pagos e pendentes</option><option value="pago">Só pagos</option><option value="pendente">Só pendentes</option>
        </select>
        <div className="flex gap-2">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="">Despesas e receitas</option><option value="despesa">Só despesas</option><option value="receita">Só receitas</option>
          </select>
          {temFiltro && <button className="btn-ghost" title="Limpar filtros" onClick={() => { setBusca(''); setCategoriaId(''); setContaId(''); setStatus(''); setTipo('') }}><X size={16} /></button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Receitas: <b className="text-emerald-600">{moeda(r.receitas)}</b></span>
        <span>Despesas: <b className="text-rose-600">{moeda(r.despesas)}</b></span>
        <span>A pagar: <b className="text-amber-600">{moeda(r.aPagar)}</b></span>
        <span className="text-slate-500">{itens.length} itens</span>
      </div>

      {grupos.length === 0 ? <Vazio>Nada {temFiltro ? 'com esses filtros' : 'neste mês'}. Use “Novo” para cadastrar ou importe do Nubank.</Vazio> : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const total = g.itens.reduce((s, i) => s + (i.tipo === 'despesa' ? i.valor : 0), 0)
            const pendente = g.itens.reduce((s, i) => s + (i.tipo === 'despesa' && !i.pago ? i.valor : 0), 0)
            return (
              <section key={g.id} className="card !p-0 overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800" style={{ borderLeft: `4px solid ${g.conta?.cor ?? '#94a3b8'}` }}>
                  <div className="font-semibold">{g.conta?.nome ?? 'Sem conta'} {g.conta?.tipo === 'cartao' && <span className="ml-1 text-xs font-normal text-slate-500">fatura{g.conta.diaVencimento ? ` · vence dia ${g.conta.diaVencimento}` : ''}</span>}</div>
                  <div className="text-sm">Total <b>{moeda(total)}</b>{pendente > 0 && <span className="ml-2 text-amber-600">({moeda(pendente)} pendente)</span>}</div>
                </header>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.itens.map((i) => (
                    <li key={i.key} className={`group flex items-center gap-3 px-4 py-2.5 text-sm ${i.pago ? 'opacity-60' : ''}`}>
                      <button onClick={() => alternarPago(i, mes)} title={i.pago ? 'Desmarcar pago' : 'Marcar como pago'}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${i.pago ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {i.pago && <Check size={13} />}
                      </button>
                      <span className="w-12 shrink-0 text-slate-500">{dataBR(i.data).slice(0, 5)}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate ${i.pago ? 'line-through' : ''}`}>
                          {i.descricao}
                          {i.parcelaInfo && <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 text-xs text-amber-600">{i.parcelaInfo}</span>}
                          {i.recorrenteTipo && <span className="ml-1.5 rounded bg-indigo-500/15 px-1.5 text-xs text-indigo-500">{i.recorrenteTipo === 'assinatura' ? 'assinatura' : i.recorrenteTipo === 'fixa' ? 'fixa' : 'receita fixa'}</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2"><BadgeCategoria cat={dados.categorias.find((c) => c.id === i.categoriaId)} />{i.dataOriginal && <span className="text-xs text-slate-400">compra em {dataBR(i.dataOriginal)}</span>}</div>
                      </div>
                      <span className={`shrink-0 font-semibold ${i.tipo === 'receita' ? 'text-emerald-600' : ''}`}>{i.tipo === 'receita' ? '+' : ''}{moeda(i.valor)}</span>
                      <div className="flex shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
                        <button className="btn-ghost !p-1.5" title="Editar" onClick={() => abrirEdicao(i)}><Pencil size={15} /></button>
                        <button className="btn-ghost !p-1.5 hover:!text-rose-500" title="Excluir" onClick={() => excluir(i)}><Trash2 size={15} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
