import { useState, type FormEvent } from 'react'
import { db } from '../lib/db'
import { arred, hojeISO, mesDe, moeda, parseValorBR, uid } from '../lib/format'
import type { Dados, Lancamento, Parcelado, Recorrente } from '../lib/types'
import type { Edicao } from '../app/contexto'
import { Campo, Modal, SelectCategoria, SelectConta } from './ui'

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

function Rodape({ fechar }: { fechar: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" className="btn-ghost" onClick={fechar}>Cancelar</button>
      <button type="submit" className="btn-primary">Salvar</button>
    </div>
  )
}

function FormLancamento({ item, dados, fechar }: { item?: Lancamento; dados: Dados; fechar: () => void }) {
  const [f, setF] = useState<Lancamento>(item ?? { id: uid(), tipo: 'despesa', descricao: '', valor: 0, data: hojeISO(), contaId: dados.contas[0]?.id })
  const [valor, setValor] = useState(item ? String(item.valor).replace('.', ',') : '')
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const v = parseValorBR(valor)
    if (!f.descricao.trim() || !(v > 0)) return alert('Preencha descrição e valor.')
    await db.lancamentos.put({ ...f, descricao: f.descricao.trim(), valor: arred(v), categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
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
      <Campo label="Valor (R$)"><input className="input" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
      <Campo label="Data"><input type="date" className="input" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
      <Campo label="Categoria"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <Campo label="Conta / cartão"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.pago ?? false} onChange={(e) => setF({ ...f, pago: e.target.checked })} /> Já está pago
      </label>
      <div className="col-span-2"><Rodape fechar={fechar} /></div>
    </form>
  )
}

function FormParcelado({ item, dados, fechar }: { item?: Parcelado; dados: Dados; fechar: () => void }) {
  const cartao = dados.contas.find((c) => c.tipo === 'cartao')
  const [f, setF] = useState<Parcelado>(item ?? { id: uid(), descricao: '', valorParcela: 0, parcelas: 10, primeiroMes: mesDe(), pagos: {}, contaId: cartao?.id })
  const [modo, setModo] = useState<'parcela' | 'total'>('parcela')
  const [valor, setValor] = useState(item ? String(item.valorParcela).replace('.', ',') : '')
  const v = parseValorBR(valor)
  const parcela = modo === 'total' ? arred(v / (f.parcelas || 1)) : v
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.descricao.trim() || !(parcela > 0) || f.parcelas < 1) return alert('Preencha descrição, valor e nº de parcelas.')
    await db.parcelados.put({ ...f, descricao: f.descricao.trim(), valorParcela: parcela, categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
    fechar()
  }
  return (
    <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
      <Campo label="Descrição" className="col-span-2"><input autoFocus className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <Campo label="Informar" className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={modo === 'parcela' ? 'btn-primary' : 'btn-outline'} onClick={() => setModo('parcela')}>Valor da parcela</button>
          <button type="button" className={modo === 'total' ? 'btn-primary' : 'btn-outline'} onClick={() => setModo('total')}>Valor total</button>
        </div>
      </Campo>
      <Campo label={modo === 'total' ? 'Valor total (R$)' : 'Valor da parcela (R$)'}><input className="input" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
      <Campo label="Nº de parcelas"><input type="number" min={1} max={120} className="input" value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: Number(e.target.value) })} /></Campo>
      <div className="col-span-2 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm dark:bg-slate-800">
        {parcela > 0 ? <><b>{f.parcelas}x de {moeda(parcela)}</b> · total {moeda(parcela * f.parcelas)}</> : 'Prévia aparece aqui'}
      </div>
      <Campo label="Mês da 1ª parcela"><input type="month" className="input" value={f.primeiroMes} onChange={(e) => setF({ ...f, primeiroMes: e.target.value })} /></Campo>
      <Campo label="Cartão / conta"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <Campo label="Categoria" className="col-span-2"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <div className="col-span-2"><Rodape fechar={fechar} /></div>
    </form>
  )
}

function FormRecorrente({ item, tipoInicial, dados, fechar }: { item?: Recorrente; tipoInicial?: Recorrente['tipo']; dados: Dados; fechar: () => void }) {
  const [f, setF] = useState<Recorrente>(item ?? { id: uid(), tipo: tipoInicial ?? 'assinatura', descricao: '', valor: 0, frequencia: 'mensal', dia: 10, inicio: mesDe(), pagos: {}, contaId: dados.contas[0]?.id })
  const [valor, setValor] = useState(item ? String(item.valor).replace('.', ',') : '')
  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const v = parseValorBR(valor)
    if (!f.descricao.trim() || !(v > 0)) return alert('Preencha descrição e valor.')
    await db.recorrentes.put({ ...f, descricao: f.descricao.trim(), valor: arred(v), fim: f.fim || undefined, categoriaId: f.categoriaId || undefined, contaId: f.contaId || undefined })
    fechar()
  }
  return (
    <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
      <Campo label="Tipo" className="col-span-2">
        <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Recorrente['tipo'] })}>
          <option value="assinatura">Assinatura</option>
          <option value="fixa">Conta fixa</option>
          <option value="receita">Receita fixa</option>
        </select>
      </Campo>
      <Campo label="Descrição" className="col-span-2"><input autoFocus className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <Campo label="Valor (R$)"><input className="input" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
      <Campo label="Frequência">
        <select className="input" value={f.frequencia} onChange={(e) => setF({ ...f, frequencia: e.target.value as Recorrente['frequencia'] })}>
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </select>
      </Campo>
      <Campo label="Dia de cobrança"><input type="number" min={1} max={31} className="input" value={f.dia} onChange={(e) => setF({ ...f, dia: Number(e.target.value) })} /></Campo>
      <Campo label="Mês de início"><input type="month" className="input" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo>
      <Campo label="Mês de fim (opcional)"><input type="month" className="input" value={f.fim ?? ''} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Campo>
      <Campo label="Conta / cartão"><SelectConta contas={dados.contas} value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} /></Campo>
      <Campo label="Categoria" className="col-span-2"><SelectCategoria categorias={dados.categorias} value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} /></Campo>
      <div className="col-span-2"><Rodape fechar={fechar} /></div>
    </form>
  )
}
