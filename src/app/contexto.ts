import { createContext, useContext } from 'react'
import type { Lancamento, Mes, Parcelado, Recorrente } from '../lib/types'
import type { OpcaoVisao } from '../lib/visao'

/** Valor do filtro de categoria que mostra os itens sem categoria (ou com categoria apagada). */
export const SEM_CATEGORIA = '__sem'

export type Pagina = 'painel' | 'extrato' | 'parcelados' | 'assinaturas' | 'importar' | 'personalizar'

export interface FiltrosExtrato {
  categoriaId?: string
  contaId?: string
}

export type Edicao =
  | { tipo: 'lancamento'; item?: Lancamento }
  | { tipo: 'parcelado'; item?: Parcelado }
  | { tipo: 'recorrente'; item?: Recorrente; tipoRecorrente?: Recorrente['tipo'] }

export interface Ctx {
  mes: Mes
  setMes: (m: Mes) => void
  ir: (p: Pagina, filtros?: FiltrosExtrato) => void
  filtrosIniciais: FiltrosExtrato
  editar: (e: Edicao) => void
  visao: string // '' = todos os bancos
  setVisao: (v: string) => void
  opcoesVisao: OpcaoVisao[]
}

export const AppCtx = createContext<Ctx>(null as any)
export const useApp = () => useContext(AppCtx)
