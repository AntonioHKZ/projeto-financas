import { useMemo, useRef, useState } from 'react'
import { FileUp, ShieldCheck, Info, CheckCircle2, Landmark, ArrowRight, Tags } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { Campo, SelectCategoria, SelectConta } from '../components/ui'
import { decodificar, lerArquivo, parseComMapeamento, type Mapeamento, type ResultadoParse } from '../lib/importadores'
import { analisar, categoriasNovasDisponiveis, contaDestino, ehNova, PREFIXO_NOVA, salvarImportacao, type Acao, type LinhaRevisao, type ResumoImport } from '../lib/importacao'
import { dataBR, moeda, nomeMes } from '../lib/format'
import type { Conta, Dados } from '../lib/types'

interface EstadoMapear { linhas: string[][]; map: Mapeamento; banco: string; nomeArquivo?: string }

export default function Importar({ dados }: { dados: Dados }) {
  const { ir, setMes } = useApp()
  const [arquivo, setArquivo] = useState<string>()
  const [mapear, setMapear] = useState<EstadoMapear>()
  const [res, setRes] = useState<ResultadoParse>()
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([])
  const [contaId, setContaId] = useState('')
  const [contaNova, setContaNova] = useState<Conta>()
  const [mesFatura, setMesFatura] = useState('')
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [feito, setFeito] = useState<ResumoImport>()
  const [filtro, setFiltro] = useState<'todos' | 'incluidos' | 'ignorados'>('todos')
  const input = useRef<HTMLInputElement>(null)

  const revisar = async (r: ResultadoParse) => {
    if (!r.transacoes.length) throw new Error('Nenhuma transação encontrada com essas configurações.')
    setRes(r)
    setMapear(undefined)
    setMesFatura(r.mesFatura ?? '')
    const destino = contaDestino(r.fonte, dados.contas, r.banco)
    setContaNova('nova' in destino ? destino.nova : undefined)
    setContaId('nova' in destino ? destino.nova.id : destino.contaId)
    setLinhas(analisar(r.transacoes, dados))
  }

  const abrir = async (f?: File) => {
    if (!f) return
    setErro(''); setFeito(undefined); setRes(undefined); setMapear(undefined)
    try {
      setArquivo(f.name)
      const leitura = lerArquivo(decodificar(await f.arrayBuffer()), f.name)
      if (leitura.tipo === 'pronto') await revisar(leitura.resultado)
      else setMapear({ linhas: leitura.linhas, map: leitura.sugestao, banco: leitura.banco ?? '', nomeArquivo: leitura.nomeArquivo })
    } catch (e: any) {
      setErro(e.message ?? 'Não consegui ler o arquivo.')
    }
    if (input.current) input.current.value = ''
  }

  const confirmarMapeamento = async () => {
    if (!mapear) return
    try {
      await revisar(parseComMapeamento(mapear.linhas, mapear.map, mapear.nomeArquivo, mapear.banco.trim() || undefined))
    } catch (e: any) {
      setErro(e.message)
    }
  }

  const mudar = (id: string, m: Partial<LinhaRevisao>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...m } : l)))

  // categorias padrão que ainda não existem aparecem na lista como "(nova)"; só são criadas se usadas
  const categoriasRevisao = useMemo(() => [
    ...dados.categorias,
    ...categoriasNovasDisponiveis(dados.categorias).map((c) => ({ ...c, nome: `${c.nome} (nova)` })),
  ], [dados.categorias])
  const novasUsadas = useMemo(() => {
    const ids = new Set(linhas.filter((l) => l.incluir && ehNova(l.categoriaId)).map((l) => l.categoriaId!))
    return categoriasRevisao.filter((c) => ids.has(c.id)).map((c) => `${c.emoji} ${c.id.slice(PREFIXO_NOVA.length)}`)
  }, [linhas, categoriasRevisao])

  const incluidas = linhas.filter((l) => l.incluir)
  const total = incluidas.reduce((s, l) => s + (l.t.tipo === 'despesa' ? l.t.valor : -l.t.valor), 0)
  const visiveis = useMemo(() => linhas.filter((l) => filtro === 'todos' || (filtro === 'incluidos') === l.incluir), [linhas, filtro])

  const salvar = async () => {
    if (!res) return
    const r = await salvarImportacao(linhas, { fonte: res.fonte, contaId, contaNova, mesFatura: mesFatura || undefined, dados })
    setFeito(r)
    setContaNova(undefined)
    setRes(undefined)
    setLinhas([])
  }

  const cancelar = () => { setRes(undefined); setMapear(undefined); setLinhas([]); setArquivo(undefined); setErro('') }

  return (
    <div>
      <Cabecalho titulo="Importar extrato ou fatura" comMes={false} comVisao={false} />

      {feito && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-500" />
          <div className="flex-1 text-sm">
            <div>
              Importação concluída: <b>{feito.avulsos}</b> lançamentos, <b>{feito.parcelados}</b> parcelados, <b>{feito.assinaturas}</b> assinaturas
              {feito.regras > 0 && <> · <b>{feito.regras}</b> regra(s) de categoria aprendida(s)</>}.
            </div>
            {feito.categoriasCriadas.length > 0 && <div className="mt-1 text-slate-500">Categorias criadas: {feito.categoriasCriadas.join(', ')}.</div>}
          </div>
          <button className="btn-primary" onClick={() => { if (feito.mesPrincipal) setMes(feito.mesPrincipal); ir('extrato') }}>Ver extrato</button>
        </div>
      )}

      {!res && !mapear && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); abrir(e.dataTransfer.files[0]) }}
            onClick={() => input.current?.click()}
            className={`card flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed text-center lg:col-span-2 ${arrastando ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''}`}>
            <FileUp size={40} className="text-accent" />
            <div className="text-lg font-semibold">Arraste o extrato ou a fatura do seu banco aqui</div>
            <div className="text-sm text-slate-500">ou clique para escolher · arquivos OFX ou CSV de qualquer banco</div>
            <input ref={input} type="file" accept=".csv,.ofx,.txt,text/csv" hidden onChange={(e) => abrir(e.target.files?.[0])} />
            {erro && <div className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{erro}</div>}
          </div>
          <div className="card space-y-3 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Landmark size={16} /> Como exportar do seu banco</h2>
            <div>
              <b>OFX (recomendado)</b>
              <p className="text-slate-500">Formato padrão que quase todo banco oferece no internet banking ou no app, em “Extrato” → “Exportar” / “Salvar como OFX” (às vezes chamado de “Money”).</p>
            </div>
            <div>
              <b>CSV</b>
              <p className="text-slate-500">Também funciona com qualquer banco: o app tenta reconhecer as colunas e você confirma antes de importar. Se o banco só dá Excel (.xlsx), abra e salve como CSV.</p>
            </div>
            <div>
              <b>Reconhecidos automaticamente</b>
              <p className="text-slate-500">CSV da fatura e do extrato do Nubank, e OFX de qualquer banco.</p>
            </div>
            <p className="flex gap-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck size={16} className="shrink-0 text-emerald-500" /> O arquivo é lido só aqui no seu navegador. Nada é enviado para a internet e o app nunca pede senha de banco.
            </p>
          </div>
        </div>
      )}

      {mapear && <PainelMapeamento estado={mapear} setEstado={setMapear} arquivo={arquivo} erro={erro} cancelar={cancelar} confirmar={confirmarMapeamento} />}

      {res && (
        <div>
          <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="label">Arquivo</span><div className="truncate text-sm font-medium">{arquivo}</div><div className="text-xs text-slate-500">{res.formato}</div></div>
            <div><span className="label">Lançar na conta / cartão</span><SelectConta contas={contaNova && !dados.contas.some((c) => c.id === contaNova.id) ? [...dados.contas, { ...contaNova, nome: `${contaNova.nome} (nova)` }] : dados.contas} value={contaId} onChange={setContaId} vazio="Escolha…" /></div>
            {res.fonte === 'cartao' ? (
              <div>
                <span className="label">Mês da fatura (vencimento)</span>
                <input type="month" className="input" value={mesFatura} onChange={(e) => setMesFatura(e.target.value)} />
                <div className="mt-0.5 text-xs text-slate-500">As compras entram no extrato de {mesFatura ? nomeMes(mesFatura) : '—'}.</div>
              </div>
            ) : <div />}
            <div className="flex flex-col justify-end gap-2">
              <div className="text-sm">{incluidas.length} de {linhas.length} selecionados · <b>{moeda(total)}</b></div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={cancelar}>Cancelar</button>
                <button className="btn-primary flex-1" disabled={!incluidas.length || !contaId || (res.fonte === 'cartao' && !mesFatura)} onClick={salvar}>Importar {incluidas.length}</button>
              </div>
            </div>
          </div>

          {novasUsadas.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm">
              <Tags size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                Ao importar, {novasUsadas.length === 1 ? 'esta categoria será criada' : `estas ${novasUsadas.length} categorias serão criadas`}: <b>{novasUsadas.join(', ')}</b>.
                <span className="text-slate-500"> Se não quiser alguma, troque a categoria dos itens marcados em verde.</span>
              </div>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            {(['todos', 'incluidos', 'ignorados'] as const).map((f) => (
              <button key={f} className={filtro === f ? 'btn-primary !py-1' : 'btn-outline !py-1'} onClick={() => setFiltro(f)}>
                {f === 'todos' ? `Todos (${linhas.length})` : f === 'incluidos' ? `Selecionados (${incluidas.length})` : `Ignorados (${linhas.length - incluidas.length})`}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
              <Info size={14} /> Categorias marcadas como “(nova)” só são criadas se você importar. Mudar uma categoria vira regra para as próximas importações.
            </span>
          </div>

          <div className="card !p-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="w-10 p-3"><input type="checkbox" checked={incluidas.length === linhas.length} onChange={(e) => setLinhas((ls) => ls.map((l) => ({ ...l, incluir: e.target.checked })))} /></th>
                  <th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3 text-right">Valor</th><th className="p-3">Tipo</th><th className="p-3">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visiveis.map((l) => (
                  <tr key={l.id} className={l.incluir ? '' : 'opacity-50'}>
                    <td className="p-3"><input type="checkbox" checked={l.incluir} onChange={(e) => mudar(l.id, { incluir: e.target.checked })} /></td>
                    <td className="whitespace-nowrap p-3 text-slate-500">{dataBR(l.t.data)}</td>
                    <td className="p-3">
                      <div>{l.t.descricao}</div>
                      {l.t.categoriaBanco && <div className="text-xs text-slate-400">no banco: {l.t.categoriaBanco}</div>}
                      {l.aviso && <div className="text-xs text-amber-600">{l.aviso}</div>}
                      {l.sugestaoAssinatura && l.acao !== 'assinatura' && <div className="text-xs text-indigo-500">Parece assinatura</div>}
                    </td>
                    <td className={`whitespace-nowrap p-3 text-right font-medium ${l.t.tipo === 'receita' ? 'text-emerald-600' : ''}`}>{l.t.tipo === 'receita' ? '+' : ''}{moeda(l.t.valor)}</td>
                    <td className="p-3">
                      <select className="input !py-1" value={l.acao} onChange={(e) => mudar(l.id, { acao: e.target.value as Acao })}>
                        <option value="avulso">{l.t.tipo === 'receita' ? 'Receita avulsa' : 'Avulso'}</option>
                        {l.t.parcela && <option value="parcelado">Parcelado ({l.t.parcela.n}/{l.t.parcela.total})</option>}
                        {l.t.tipo === 'despesa' && !l.t.parcela && <option value="assinatura">Assinatura (todo mês)</option>}
                      </select>
                    </td>
                    <td className="w-52 p-3"><SelectCategoria categorias={categoriasRevisao} value={l.categoriaId} onChange={(v) => mudar(l.id, { categoriaId: v || undefined })} className={ehNova(l.categoriaId) ? '!border-emerald-500/60' : ''} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PainelMapeamento({ estado, setEstado, arquivo, erro, cancelar, confirmar }: {
  estado: EstadoMapear; setEstado: (e: EstadoMapear) => void; arquivo?: string; erro: string; cancelar: () => void; confirmar: () => void
}) {
  const { linhas, map, banco } = estado
  const set = (m: Partial<Mapeamento>) => setEstado({ ...estado, map: { ...map, ...m } })
  const cab = map.linhaCabecalho >= 0 ? linhas[map.linhaCabecalho] : undefined
  const exemplo = linhas[map.linhaCabecalho + 1] ?? []
  const nCols = Math.max(...linhas.slice(0, 30).map((l) => l.length))
  const opcoes = Array.from({ length: nCols }, (_, k) => ({ k, rotulo: `${k + 1}. ${cab?.[k]?.trim() || 'sem nome'}${exemplo[k] ? ` (ex.: ${exemplo[k].trim().slice(0, 24)})` : ''}` }))
  const prev = useMemo(() => {
    try { return parseComMapeamento(linhas, map, estado.nomeArquivo, banco || undefined).transacoes } catch { return [] }
  }, [linhas, map, banco, estado.nomeArquivo])
  const separado = map.colValor < 0

  const SelCol = ({ valor, onChange }: { valor: number; onChange: (k: number) => void }) => (
    <select className="input" value={valor} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={-1}>—</option>
      {opcoes.map((o) => <option key={o.k} value={o.k}>{o.rotulo}</option>)}
    </select>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card space-y-3 lg:col-span-2">
        <div>
          <h2 className="font-semibold">Confirme as colunas</h2>
          <p className="text-sm text-slate-500">Não reconheci o formato de <b>{arquivo}</b> automaticamente. Confira as sugestões e veja a prévia ao lado.</p>
        </div>
        <Campo label="Banco (opcional, usado para nomear a conta)">
          <input className="input" placeholder="ex.: Inter, Itaú…" value={banco} onChange={(e) => setEstado({ ...estado, banco: e.target.value })} />
        </Campo>
        <Campo label="Este arquivo é">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={map.fonte === 'cartao' ? 'btn-primary' : 'btn-outline'} onClick={() => set({ fonte: 'cartao' })}>Fatura de cartão</button>
            <button type="button" className={map.fonte === 'conta' ? 'btn-primary' : 'btn-outline'} onClick={() => set({ fonte: 'conta' })}>Extrato de conta</button>
          </div>
        </Campo>
        <Campo label="Coluna da data"><SelCol valor={map.colData} onChange={(k) => set({ colData: k })} /></Campo>
        <Campo label="Coluna da descrição"><SelCol valor={map.colDesc} onChange={(k) => set({ colDesc: k })} /></Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={separado} onChange={(e) => set(e.target.checked ? { colValor: -1 } : { colValor: map.colCredito >= 0 ? map.colCredito : 0 })} />
          Entradas e saídas ficam em colunas separadas
        </label>
        {separado ? (
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Coluna de entradas (crédito)"><SelCol valor={map.colCredito} onChange={(k) => set({ colCredito: k })} /></Campo>
            <Campo label="Coluna de saídas (débito)"><SelCol valor={map.colDebito} onChange={(k) => set({ colDebito: k })} /></Campo>
          </div>
        ) : (
          <Campo label="Coluna do valor"><SelCol valor={map.colValor} onChange={(k) => set({ colValor: k })} /></Campo>
        )}
        <Campo label="Coluna da categoria do banco (opcional)"><SelCol valor={map.colCategoria} onChange={(k) => set({ colCategoria: k })} /></Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={map.inverter} onChange={(e) => set({ inverter: e.target.checked })} />
          Inverter sinais (use se gastos aparecerem como receitas na prévia)
        </label>
        <Campo label="Linha do cabeçalho (0 = primeira)">
          <input type="number" min={-1} max={30} className="input w-24" value={map.linhaCabecalho} onChange={(e) => set({ linhaCabecalho: Number(e.target.value) })} />
        </Campo>
        {erro && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{erro}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={cancelar}>Cancelar</button>
          <button className="btn-primary" disabled={!prev.length} onClick={confirmar}>Continuar <ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="card lg:col-span-3">
        <h2 className="mb-2 font-semibold">Prévia ({prev.length} transações)</h2>
        {prev.length === 0 ? <p className="text-sm text-slate-500">Nenhuma transação com essa configuração. Ajuste as colunas.</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {prev.slice(0, 12).map((t) => (
                <tr key={t.hash}>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-slate-500">{dataBR(t.data)}</td>
                  <td className="py-1.5 pr-3">{t.descricao}{t.parcela && <span className="ml-1 text-xs text-amber-600">({t.parcela.n}/{t.parcela.total})</span>}{t.categoriaBanco && <span className="ml-2 text-xs text-slate-400">{t.categoriaBanco}</span>}</td>
                  <td className={`whitespace-nowrap py-1.5 text-right font-medium ${t.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.tipo === 'receita' ? '+' : '−'}{moeda(t.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {prev.length > 12 && <p className="mt-2 text-xs text-slate-500">…e mais {prev.length - 12}.</p>}
      </div>
    </div>
  )
}
