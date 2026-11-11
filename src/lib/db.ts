import Dexie, { type EntityTable } from 'dexie'
import type { Categoria, Conta, Lancamento, Parcelado, Recorrente, Regra, Dados } from './types'
import { uid } from './format'

export const db = new Dexie('financas') as Dexie & {
  categorias: EntityTable<Categoria, 'id'>
  contas: EntityTable<Conta, 'id'>
  lancamentos: EntityTable<Lancamento, 'id'>
  parcelados: EntityTable<Parcelado, 'id'>
  recorrentes: EntityTable<Recorrente, 'id'>
  regras: EntityTable<Regra, 'id'>
}

db.version(1).stores({
  categorias: 'id, nome',
  contas: 'id, nome',
  lancamentos: 'id, data, importHash',
  parcelados: 'id, importKey',
  recorrentes: 'id, tipo',
  regras: 'id',
})

// v2: valores em dinheiro passam de reais (decimal) para centavos (inteiro)
const c = (v?: number) => (typeof v === 'number' ? Math.round(v * 100) : v)
db.version(2).stores({}).upgrade(async (tx) => {
  await tx.table('lancamentos').toCollection().modify((l) => { l.valor = c(l.valor) })
  await tx.table('parcelados').toCollection().modify((p) => { p.valorParcela = c(p.valorParcela) })
  await tx.table('recorrentes').toCollection().modify((r) => { r.valor = c(r.valor) })
  await tx.table('categorias').toCollection().modify((k) => { if (k.limite) k.limite = c(k.limite) })
})

/** Versão atual do formato de backup. 1 = valores em reais; 2 = valores em centavos. */
export const VERSAO_BACKUP = 2

/** Converte um backup antigo (valores em reais) para centavos. */
export function migrarBackup(d: any): Partial<Dados> {
  if ((d.versao ?? 1) >= 2) return d
  return {
    ...d,
    lancamentos: (d.lancamentos ?? []).map((l: any) => ({ ...l, valor: c(l.valor) })),
    parcelados: (d.parcelados ?? []).map((p: any) => ({ ...p, valorParcela: c(p.valorParcela) })),
    recorrentes: (d.recorrentes ?? []).map((r: any) => ({ ...r, valor: c(r.valor) })),
    categorias: (d.categorias ?? []).map((k: any) => ({ ...k, limite: k.limite ? c(k.limite) : undefined })),
  }
}

export const TABELAS =['categorias', 'contas', 'lancamentos', 'parcelados', 'recorrentes', 'regras'] as const

export const CATEGORIAS_PADRAO: Omit<Categoria, 'id'>[] = [
  { nome: 'Alimentação', emoji: '🍔', cor: '#f97316' },
  { nome: 'Mercado', emoji: '🛒', cor: '#84cc16' },
  { nome: 'Transporte', emoji: '🚗', cor: '#0ea5e9' },
  { nome: 'Moradia', emoji: '🏠', cor: '#a855f7' },
  { nome: 'Saúde', emoji: '💊', cor: '#ef4444' },
  { nome: 'Lazer', emoji: '🎮', cor: '#ec4899' },
  { nome: 'Assinaturas', emoji: '📺', cor: '#6366f1' },
  { nome: 'Compras', emoji: '🛍️', cor: '#eab308' },
  { nome: 'Educação', emoji: '📚', cor: '#14b8a6' },
  { nome: 'Salário', emoji: '💼', cor: '#22c55e' },
  { nome: 'Outros', emoji: '📦', cor: '#64748b' },
]

export const CONTAS_PADRAO: Omit<Conta, 'id'>[] = [
  { nome: 'Nubank Cartão', banco: 'Nubank', tipo: 'cartao', cor: '#820ad1', diaVencimento: 10 },
  { nome: 'Nubank Conta', banco: 'Nubank', tipo: 'conta', cor: '#a855f7' },
  { nome: 'Dinheiro', tipo: 'dinheiro', cor: '#16a34a' },
]

/** Cria as categorias e contas sugeridas (só as que ainda não existem). Opcional — o app começa vazio. */
export async function criarSugestoes() {
  await db.transaction('rw', db.categorias, db.contas, async () => {
    if ((await db.categorias.count()) === 0)
      await db.categorias.bulkAdd(CATEGORIAS_PADRAO.map((c) => ({ ...c, id: uid() })))
    if ((await db.contas.count()) === 0)
      await db.contas.bulkAdd(CONTAS_PADRAO.map((c) => ({ ...c, id: uid() })))
  })
}

export async function exportarTudo(): Promise<Dados> {
  return {
    categorias: await db.categorias.toArray(),
    contas: await db.contas.toArray(),
    lancamentos: await db.lancamentos.toArray(),
    parcelados: await db.parcelados.toArray(),
    recorrentes: await db.recorrentes.toArray(),
    regras: await db.regras.toArray(),
  }
}

export async function substituirTudo(d: Partial<Dados>) {
  await db.transaction('rw', TABELAS.map((t) => db[t]), async () => {
    for (const t of TABELAS) {
      await db[t].clear()
      const linhas = d[t]
      if (Array.isArray(linhas) && linhas.length) await (db[t] as any).bulkAdd(linhas)
    }
  })
}

export async function apagarTudo() {
  await substituirTudo({})
}
