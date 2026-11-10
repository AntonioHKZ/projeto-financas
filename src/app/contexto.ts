import { createContext, useContext } from 'react'
import type { Lancamento, Mes, Parcelado, Recorrente } from '../lib/types'

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
}

export const AppCtx = createContext<Ctx>(null as any)
export const useApp = () => useContext(AppCtx)
