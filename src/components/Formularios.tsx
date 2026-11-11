import { useState, type FormEvent } from 'react'
import { db } from '../lib/db'
import { dataBR, hojeISO, mesDe, moeda, uid } from '../lib/format'
import { dataDoRecorrente } from '../lib/mes'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
import type { Dados, Lancamento, Parcelado, Recorrente } from '../lib/types'
import type { Edicao } from '../app/contexto'
import { Campo, InputMoeda, Modal, SelectCategoria, SelectConta } from './ui'
import { avisar } from './Dialogos'

const TITULOS = { lancamento: 'Lançamento', parcelado: 'Compra parcelada', recorrente: 'Recorrente' }

export function ModalEdicao({ edicao, fechar, dados }: { edicao: Edicao | null; fechar: () => void; dados: Dados }) {
  const [aba, setAba] = useState<Edicao['tipo']>(edicao?.tipo ?? 'lancamento')
  if (!edicao) return null
  const novo = !edicao.item
  const tipo = novo ? aba : edicao.tipo
  return (
    <Modal aberto titulo={novo ? 'Novo cadastro' : `Editar ${TITULOS[edicao.tipo].toLowerCase()}`} fechar={fechar}>
      {novo && (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['lancamento', 'parcelado', 'recorrente'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setAba(t)}
              className={`rounded-lg py-1.5 text-sm font-medium ${aba === t ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}>
              {TITULOS[t]}
            </button>
          ))}
        </div>
      )}
      {tipo === 'lancamento' && <FormLancamento item={edicao.tipo === 'lancamento' ? edicao.item : undefined} dados={dados} fechar={fechar} />}
      {tipo === 'parcelado' && <FormParcelado item={edicao.tipo === 'parcelado' ? edicao.item : undefined} dados={dados} fechar={fechar} />}
      {tipo === 'recorrente' && (
        <FormRecorrente item={edicao.tipo === 'recorrente' ? edicao.item : undefined}
          tipoInicial={edicao.tipo === 'recorrente' ? edicao.tipoRecorrente : undefined} dados={dados} fechar={fechar} />
      )}
    </Modal>
  )
}

function Rodape({ fechar, erro }: { fechar: () => void; erro?: string }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {erro && <p role="alert" className="mr-auto text-sm text-rose-600">{erro}</p>}
      <button type="button" className="btn-ghost" onClick={fechar}>Cancelar</button>
      <button type="submit" className="btn-primary">Salvar</button>
    </div>
  )
}

function FormLancamento({ item, dados, fechar }: { item?: Lancamento; dados: Dados; fechar: () => void }) {
  const [f, setF] = useState<Lancamento>(item ?? { id: uid(), tipo: 'despesa', descricao: '', valor: 0, data: hojeISO(), contaId: dados.contas[0]?.id })
  const [erro, setErro] = useState('')
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.descricao.trim() || f.valor <= 0) return setErro('Preencha a descrição e um valor maior que zero.')
    await db.lancamentos.put({ ...f, descricao: f.descricao.trim(), categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
    avisar(item ? 'Lançamento atualizado.' : 'Lançamento salvo.')
    fechar()
  }
  return (
    <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
      <Campo label="Tipo" className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          {(['despesa', 'receita'] as const).map((t) => (
            <button type="button" key={t} onClick={() => setF({ ...f, tipo: t })}
              className={`btn border ${f.tipo === t ? (t === 'despesa' ? 'border-rose-500 bg-rose-500/10 text-rose-600' : 'border-emerald-500 bg-emerald-500/10 text-emerald-600') : 'border-slate-300 dark:border-slate-700'}`}>
              {t === 'despesa' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>
      </Campo>
      <Campo label="Descrição" className="col-span-2"><input autoFocus className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <Campo label="Valor"><InputMoeda valor={f.valor} onChange={(valor) => setF({ ...f, valor })} /></Campo>
      <Campo label="Data"><input type="date" className="input" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
      <Campo label="Categoria"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <Campo label="Conta / cartão"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.pago ?? false} onChange={(e) => setF({ ...f, pago: e.target.checked })} /> Já está pago
      </label>
      <div className="col-span-2"><Rodape fechar={fechar} erro={erro} /></div>
    </form>
  )
}

function FormParcelado({ item, dados, fechar }: { item?: Parcelado; dados: Dados; fechar: () => void }) {
  const cartao = dados.contas.find((c) => c.tipo === 'cartao')
  const [f, setF] = useState<Parcelado>(item ?? { id: uid(), descricao: '', valorParcela: 0, parcelas: 10, primeiroMes: mesDe(), pagos: {}, contaId: cartao?.id })
  const [modo, setModo] = useState<'parcela' | 'total'>('parcela')
  const [valor, setValor] = useState<number>(item?.valorParcela ?? 0) // centavos: parcela ou total, conforme o modo
  const [erro, setErro] = useState('')
  const parcela = modo === 'total' ? Math.round(valor / (f.parcelas || 1)) : valor
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.descricao.trim() || !(parcela > 0) || f.parcelas < 1) return setErro('Preencha a descrição, o valor e o nº de parcelas.')
    await db.parcelados.put({ ...f, descricao: f.descricao.trim(), valorParcela: parcela, categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
    avisar(item ? 'Alterações salvas.' : 'Salvo.')
    fechar()
  }
  return (
    <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
      <Campo label="Descrição" className="col-span-2"><input autoFocus className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <Campo label="Informar" className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={modo === 'parcela' ? 'btn-primary' : 'btn-outline'} onClick={() => { if (modo === 'total') setValor(parcela); setModo('parcela') }}>Valor da parcela</button>
          <button type="button" className={modo === 'total' ? 'btn-primary' : 'btn-outline'} onClick={() => { if (modo === 'parcela') setValor(valor * (f.parcelas || 1)); setModo('total') }}>Valor total</button>
        </div>
      </Campo>
      <Campo label={modo === 'total' ? 'Valor total' : 'Valor da parcela'}><InputMoeda valor={valor} onChange={setValor} /></Campo>
      <Campo label="Nº de parcelas"><input type="number" min={1} max={120} className="input" value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: Number(e.target.value) })} /></Campo>
      <div className="col-span-2 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm dark:bg-slate-800">
        {parcela > 0 ? <><b>{f.parcelas}x de {moeda(parcela)}</b> · total {moeda(parcela * f.parcelas)}</> : 'Prévia aparece aqui'}
      </div>
      <Campo label="Mês da 1ª parcela"><input type="month" className="input" value={f.primeiroMes} onChange={(e) => setF({ ...f, primeiroMes: e.target.value })} /></Campo>
      <Campo label="Cartão / conta"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <Campo label="Categoria" className="col-span-2"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <div className="col-span-2"><Rodape fechar={fechar} erro={erro} /></div>
    </form>
  )
}

function FormRecorrente({ item, tipoInicial, dados, fechar }: { item?: Recorrente; tipoInicial?: Recorrente['tipo']; dados: Dados; fechar: () => void }) {
  // receita fixa (salário) já começa em "5º dia útil"; o resto, em dia fixo
  const padraoDia = (t: Recorrente['tipo']) => (t === 'receita' ? { dia: 5, diaUtil: true, sabadoUtil: true } : { dia: 10, diaUtil: false })
  const tipo0 = tipoInicial ?? 'assinatura'
  const [f, setF] = useState<Recorrente>(item ?? { id: uid(), tipo: tipo0, descricao: '', valor: 0, frequencia: 'mensal', ...padraoDia(tipo0), inicio: mesDe(), pagos: {}, contaId: dados.contas[0]?.id })
  const [erro, setErro] = useState('')
  const ehSalario = /sal[aá]rio|holerite|folha/i.test(f.descricao)
  const maxDia = f.diaUtil ? 23 : 31
  const proxima = dataDoRecorrente(f, f.inicio > mesDe() ? f.inicio : mesDe())
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.descricao.trim() || f.valor <= 0) return setErro('Preencha a descrição e um valor maior que zero.')
    if (!(f.dia >= 1 && f.dia <= maxDia)) return setErro(f.diaUtil ? 'Escolha entre o 1º e o 23º dia útil.' : 'Escolha um dia entre 1 e 31.')
    await db.recorrentes.put({ ...f, descricao: f.descricao.trim(), fim: f.fim || undefined, categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
    avisar(item ? 'Alterações salvas.' : 'Salvo.')
    fechar()
  }
  return (
    <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
      <Campo label="Tipo" className="col-span-2">
        <select className="input" value={f.tipo} onChange={(e) => { const tipo = e.target.value as Recorrente['tipo']; setF({ ...f, tipo, ...(item ? {} : padraoDia(tipo)) }) }}>
          <option value="assinatura">Assinatura</option>
          <option value="fixa">Conta fixa</option>
          <option value="receita">Receita fixa</option>
        </select>
      </Campo>
      <Campo label="Descrição" className="col-span-2"><input autoFocus className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <Campo label="Valor"><InputMoeda valor={f.valor} onChange={(valor) => setF({ ...f, valor })} /></Campo>
      <Campo label="Frequência">
        <select className="input" value={f.frequencia} onChange={(e) => setF({ ...f, frequencia: e.target.value as Recorrente['frequencia'] })}>
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </select>
      </Campo>
      <div className="col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <span className="label">{f.tipo === 'receita' ? 'Quando cai' : 'Dia de cobrança'}</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={!f.diaUtil ? 'btn-primary' : 'btn-outline'} onClick={() => setF({ ...f, diaUtil: false, dia: Math.min(f.dia, 31) })}>Dia fixo do mês</button>
          <button type="button" className={f.diaUtil ? 'btn-primary' : 'btn-outline'} onClick={() => setF({ ...f, diaUtil: true, sabadoUtil: f.sabadoUtil ?? true, dia: Math.min(f.dia, 23) })}>Dia útil</button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {!f.diaUtil && <span className="whitespace-nowrap text-sm text-slate-500">Todo dia</span>}
          <input type="number" min={1} max={maxDia} className="input !w-20 text-center" value={f.dia || ''}
            onChange={(e) => setF({ ...f, dia: Math.min(maxDia, Math.max(0, Math.trunc(Number(e.target.value) || 0))) })} />
          {f.diaUtil && <span className="whitespace-nowrap text-sm">º dia útil</span>}
          <span className="ml-auto text-right text-xs text-slate-500">próxima: <b>{dataBR(proxima)}</b> ({DIAS_SEMANA[new Date(proxima + 'T12:00').getDay()]})</span>
        </div>
        {f.diaUtil && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={f.sabadoUtil ?? true} onChange={(e) => setF({ ...f, sabadoUtil: e.target.checked })} />
            Contar sábado como dia útil (regra da CLT para salário)
          </label>
        )}
        {ehSalario && !f.diaUtil && (
          <p className="mt-2 text-xs text-amber-600">
            Salário costuma ser pago até o 5º dia útil.{' '}
            <button type="button" className="underline" onClick={() => setF({ ...f, diaUtil: true, sabadoUtil: true, dia: 5 })}>Usar “5º dia útil”</button>
          </p>
        )}
      </div>
      <Campo label="Mês de início"><input type="month" className="input" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo>
      <Campo label="Mês de fim (opcional)"><input type="month" className="input" value={f.fim ?? ''} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Campo>
      <Campo label="Conta / cartão"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <Campo label="Categoria" className="col-span-2"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <div className="col-span-2"><Rodape fechar={fechar} erro={erro} /></div>
    </form>
  )
}
