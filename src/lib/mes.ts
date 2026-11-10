import type { Dados, ItemMes, Mes, Parcelado, Recorrente } from './types'
import { addMes, dataNoMes, diffMes, mesDe } from './format'

/** Meses passados contam como pagos por padrão. */
export function pagoPadrao(m: Mes, hoje: Mes = mesDe()): boolean {
  return diffMes(m, hoje) > 0
}

export function parcelaNoMes(p: Parcelado, m: Mes): number | null {
  const i = diffMes(p.primeiroMes, m) + 1
  return i >= 1 && i <= p.parcelas ? i : null
}

export function ultimoMes(p: Parcelado): Mes {
  return addMes(p.primeiroMes, p.parcelas - 1)
}

export function recorrenteAtivo(r: Recorrente, m: Mes): boolean {
  if (diffMes(r.inicio, m) < 0) return false
  if (r.fim && diffMes(m, r.fim) < 0) return false
  if (r.frequencia === 'anual') return r.inicio.slice(5) === m.slice(5)
  return true
}

export function custoMensal(r: Recorrente): number {
  return r.frequencia === 'anual' ? r.valor / 12 : r.valor
}

export function isPagoMapa(mapa: Record<Mes, boolean>, m: Mes): boolean {
  return mapa[m] ?? pagoPadrao(m)
}

export function gerarMes(m: Mes, d: Pick<Dados, 'lancamentos' | 'parcelados' | 'recorrentes' | 'contas'>): ItemMes[] {
  const itens: ItemMes[] = []
  const venc = (contaId?: string) => d.contas.find((c) => c.id === contaId)?.diaVencimento ?? 10

  for (const l of d.lancamentos) {
    if (!l.data.startsWith(m)) continue
    itens.push({
      key: `a:${l.id}`,
      origem: 'avulso',
      refId: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data: l.data,
      dataOriginal: l.dataOriginal,
      categoriaId: l.categoriaId,
      contaId: l.contaId,
      pago: l.pago ?? pagoPadrao(m),
      grupo: 'avulsos',
    })
  }

  for (const p of d.parcelados) {
    const n = parcelaNoMes(p, m)
    if (!n) continue
    itens.push({
      key: `p:${p.id}:${m}`,
      origem: 'parcela',
      refId: p.id,
      tipo: 'despesa',
      descricao: p.descricao,
      valor: p.valorParcela,
      data: dataNoMes(m, venc(p.contaId)),
      categoriaId: p.categoriaId,
      contaId: p.contaId,
      pago: isPagoMapa(p.pagos, m),
      grupo: 'parcelas',
      parcelaInfo: `${n}/${p.parcelas}`,
    })
  }

  for (const r of d.recorrentes) {
    if (!recorrenteAtivo(r, m)) continue
    itens.push({
      key: `r:${r.id}:${m}`,
      origem: 'recorrente',
      refId: r.id,
      tipo: r.tipo === 'receita' ? 'receita' : 'despesa',
      descricao: r.descricao,
      valor: r.valor,
      data: dataNoMes(m, r.dia),
      categoriaId: r.categoriaId,
      contaId: r.contaId,
      pago: isPagoMapa(r.pagos, m),
      grupo: 'fixas',
      recorrenteTipo: r.tipo,
    })
  }

  return itens.sort((a, b) => a.data.localeCompare(b.data))
}

export function resumo(itens: ItemMes[]) {
  let receitas = 0, despesas = 0, aPagar = 0
  for (const i of itens) {
    if (i.tipo === 'receita') receitas += i.valor
    else {
      despesas += i.valor
      if (!i.pago) aPagar += i.valor
    }
  }
  return { receitas, despesas, saldo: receitas - despesas, aPagar }
}
