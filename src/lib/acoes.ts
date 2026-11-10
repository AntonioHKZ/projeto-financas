import { db } from './db'
import type { ItemMes, Mes } from './types'

export async function alternarPago(item: ItemMes, mes: Mes) {
  const novo = !item.pago
  if (item.origem === 'avulso') {
    await db.lancamentos.update(item.refId, { pago: novo })
  } else if (item.origem === 'parcela') {
    const p = await db.parcelados.get(item.refId)
    if (p) await db.parcelados.update(p.id, { pagos: { ...p.pagos, [mes]: novo } })
  } else {
    const r = await db.recorrentes.get(item.refId)
    if (r) await db.recorrentes.update(r.id, { pagos: { ...r.pagos, [mes]: novo } })
  }
}

export async function excluirItem(item: ItemMes) {
  if (item.origem === 'avulso') await db.lancamentos.delete(item.refId)
  else if (item.origem === 'parcela') await db.parcelados.delete(item.refId)
  else await db.recorrentes.delete(item.refId)
}
