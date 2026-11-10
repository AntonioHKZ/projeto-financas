import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Dados } from './types'

const VAZIO: Dados = { categorias: [], contas: [], lancamentos: [], parcelados: [], recorrentes: [], regras: [] }

export function useDados(): Dados & { carregado: boolean } {
  const d = useLiveQuery(async () => {
    const [categorias, contas, lancamentos, parcelados, recorrentes, regras] = await Promise.all([
      db.categorias.toArray(),
      db.contas.toArray(),
      db.lancamentos.toArray(),
      db.parcelados.toArray(),
      db.recorrentes.toArray(),
      db.regras.toArray(),
    ])
    const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR')
    return { categorias: categorias.sort(porNome), contas: contas.sort(porNome), lancamentos, parcelados, recorrentes, regras }
  })
  return { ...(d ?? VAZIO), carregado: !!d }
}
