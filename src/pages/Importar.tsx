import { useMemo, useRef, useState } from 'react'
import { FileUp, ShieldCheck, Info, CheckCircle2, Smartphone } from 'lucide-react'
import { useApp } from '../app/contexto'
import { Cabecalho } from '../components/Cabecalho'
import { SelectCategoria, SelectConta } from '../components/ui'
import { analisarArquivo, type ResultadoParse } from '../lib/nubank'
import { analisar, contaDestino, salvarImportacao, type Acao, type LinhaRevisao, type ResumoImport } from '../lib/importacao'
import { dataBR, moeda, nomeMes } from '../lib/format'
import type { Dados } from '../lib/types'

const NOME_FORMATO: Record<ResultadoParse['formato'], string> = {
  'nubank-cartao-csv': 'Fatura do cartão Nubank (CSV)',
  'nubank-conta-csv': 'Extrato da conta Nubank (CSV)',
  'ofx-cartao': 'Fatura do cartão (OFX)',
  'ofx-conta': 'Extrato da conta (OFX)',
}

export default function Importar({ dados }: { dados: Dados }) {
  const { ir, setMes } = useApp()
  const [arquivo, setArquivo] = useState<string>()
  const [res, setRes] = useState<ResultadoParse>()
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([])
  const [contaId, setContaId] = useState('')
  const [mesFatura, setMesFatura] = useState('')
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [feito, setFeito] = useState<ResumoImport>()
  const [filtro, setFiltro] = useState<'todos' | 'incluidos' | 'ignorados'>('todos')
  const input = useRef<HTMLInputElement>(null)

  const abrir = async (f?: File) => {
    if (!f) return
    setErro(''); setFeito(undefined)
    try {
      const r = analisarArquivo(await f.text(), f.name)
      if (!r.transacoes.length) throw new Error('Nenhuma transação encontrada no arquivo.')
      setArquivo(f.name)
      setRes(r)
      setMesFatura(r.mesFatura ?? '')
      setContaId(await contaDestino(r.fonte, dados.contas))
      setLinhas(analisar(r.transacoes, dados))
    } catch (e: any) {
      setErro(e.message ?? 'Não consegui ler o arquivo.')
      setRes(undefined)
    }
    if (input.current) input.current.value = ''
  }

  const mudar = (id: string, m: Partial<LinhaRevisao>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...m } : l)))
  const incluidas = linhas.filter((l) => l.incluir)
  const total = incluidas.reduce((s, l) => s + (l.t.tipo === 'despesa' ? l.t.valor : -l.t.valor), 0)
  const visiveis = useMemo(() => linhas.filter((l) => filtro === 'todos' || (filtro === 'incluidos') === l.incluir), [linhas, filtro])

  const salvar = async () => {
    if (!res) return
    const r = await salvarImportacao(linhas, { fonte: res.fonte, contaId, mesFatura: mesFatura || undefined, dados })
    setFeito(r)
    setRes(undefined)
    setLinhas([])
  }

  const cancelar = () => { setRes(undefined); setLinhas([]); setArquivo(undefined) }

  return (
    <div>
      <Cabecalho titulo="Importar do Nubank" comMes={false} />

      {feito && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-500" />
          <div className="flex-1 text-sm">
            Importação concluída: <b>{feito.avulsos}</b> lançamentos, <b>{feito.parcelados}</b> parcelados, <b>{feito.assinaturas}</b> assinaturas
            {feito.regras > 0 && <> · <b>{feito.regras}</b> regra(s) de categoria aprendida(s)</>}.
          </div>
          <button className="btn-primary" onClick={() => { if (mesFatura) setMes(mesFatura); ir('extrato') }}>Ver extrato</button>
        </div>
      )}

      {!res && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); abrir(e.dataTransfer.files[0]) }}
            onClick={() => input.current?.click()}
            className={`card flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed text-center lg:col-span-2 ${arrastando ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''}`}>
            <FileUp size={40} className="text-accent" />
            <div className="text-lg font-semibold">Arraste o arquivo do Nubank aqui</div>
            <div className="text-sm text-slate-500">ou clique para escolher · CSV da fatura, CSV do extrato da conta ou OFX</div>
            <input ref={input} type="file" accept=".csv,.ofx,text/csv" hidden onChange={(e) => abrir(e.target.files?.[0])} />
            {erro && <div className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{erro}</div>}
          </div>
          <div className="card space-y-3 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Smartphone size={16} /> Como exportar do Nubank</h2>
            <div>
              <b>Fatura do cartão (CSV)</b>
              <p className="text-slate-500">No app: Cartão de crédito → Faturas → escolha a fatura → “Exportar fatura” / enviar por e-mail. Pelo site (app.nubank.com.br) também dá para baixar o CSV.</p>
            </div>
            <div>
              <b>Extrato da conta (CSV ou OFX)</b>
              <p className="text-slate-500">No app: Conta → ícone de extrato/“Pedir extrato” → escolha o período e o formato. O arquivo chega por e-mail.</p>
            </div>
            <p className="flex gap-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck size={16} className="shrink-0 text-emerald-500" /> O arquivo é lido só aqui no seu navegador. Nada é enviado para a internet e o app nunca pede sua senha do banco.
            </p>
          </div>
        </div>
      )}

      {res && (
        <div>
          <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="label">Arquivo</span><div className="truncate text-sm font-medium">{arquivo}</div><div className="text-xs text-slate-500">{NOME_FORMATO[res.formato]}</div></div>
            <div><span className="label">Lançar na conta</span><SelectConta contas={dados.contas} value={contaId} onChange={setContaId} /></div>
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

          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            {(['todos', 'incluidos', 'ignorados'] as const).map((f) => (
              <button key={f} className={filtro === f ? 'btn-primary !py-1' : 'btn-outline !py-1'} onClick={() => setFiltro(f)}>
                {f === 'todos' ? `Todos (${linhas.length})` : f === 'incluidos' ? `Selecionados (${incluidas.length})` : `Ignorados (${linhas.length - incluidas.length})`}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-500"><Info size={14} /> Mudar uma categoria cria uma regra para as próximas importações.</span>
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
                    <td className="w-52 p-3"><SelectCategoria categorias={dados.categorias} value={l.categoriaId} onChange={(v) => mudar(l.id, { categoriaId: v || undefined })} /></td>
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
