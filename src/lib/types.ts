import type { Centavos } from './format'

export type Mes = string // 'YYYY-MM'
// Todos os valores em dinheiro são inteiros em centavos (ver format.ts).

export interface Categoria {
  id: string
  nome: string
  emoji: string
  cor: string
  limite?: Centavos
}

export type TipoConta = 'cartao' | 'conta' | 'dinheiro'

export interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  cor: string
  diaVencimento?: number
  banco?: string // ex.: "Nubank", "Inter" — define a "visão por banco"
}

export type TipoLancamento = 'despesa' | 'receita'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: Centavos
  data: string // 'YYYY-MM-DD' — data em que conta no extrato (para cartão: vencimento da fatura)
  dataOriginal?: string // data da compra, quando diferente (importações de fatura)
  categoriaId?: string
  contaId?: string
  pago?: boolean // undefined = padrão (mês passado conta como pago)
  importHash?: string
}

export interface Parcelado {
  id: string
  descricao: string
  valorParcela: Centavos
  parcelas: number
  primeiroMes: Mes
  categoriaId?: string
  contaId?: string
  pagos: Record<Mes, boolean>
  importKey?: string
}

export type TipoRecorrente = 'assinatura' | 'fixa' | 'receita'

export interface Recorrente {
  id: string
  tipo: TipoRecorrente
  descricao: string
  valor: Centavos
  frequencia: 'mensal' | 'anual'
  dia: number // dia do mês, ou o "N" de "Nº dia útil" quando diaUtil = true
  diaUtil?: boolean // ex.: salário "até o 5º dia útil"
  sabadoUtil?: boolean // na contagem de dias úteis, sábado conta? (padrão: sim, regra da CLT)
  inicio: Mes
  fim?: Mes
  categoriaId?: string
  contaId?: string
  pagos: Record<Mes, boolean>
}

export interface Regra {
  id: string
  contem: string
  categoriaId: string
}

export type Origem = 'avulso' | 'parcela' | 'recorrente'
export type Grupo = 'parcelas' | 'fixas' | 'avulsos'

export interface ItemMes {
  key: string
  origem: Origem
  refId: string
  tipo: TipoLancamento
  descricao: string
  valor: Centavos
  data: string
  dataOriginal?: string
  categoriaId?: string
  contaId?: string
  pago: boolean
  grupo: Grupo
  parcelaInfo?: string
  recorrenteTipo?: TipoRecorrente
  previsao?: string // ex.: "até o 5º dia útil"
}

export interface Dados {
  categorias: Categoria[]
  contas: Conta[]
  lancamentos: Lancamento[]
  parcelados: Parcelado[]
  recorrentes: Recorrente[]
  regras: Regra[]
}
