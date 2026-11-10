export type Mes = string // 'YYYY-MM'

export interface Categoria {
  id: string
  nome: string
  emoji: string
  cor: string
  limite?: number
}

export type TipoConta = 'cartao' | 'conta' | 'dinheiro'

export interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  cor: string
  diaVencimento?: number
}

export type TipoLancamento = 'despesa' | 'receita'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
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
  valorParcela: number
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
  valor: number
  frequencia: 'mensal' | 'anual'
  dia: number
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
  valor: number
  data: string
  dataOriginal?: string
  categoriaId?: string
  contaId?: string
  pago: boolean
  grupo: Grupo
  parcelaInfo?: string
  recorrenteTipo?: TipoRecorrente
}

export interface Dados {
  categorias: Categoria[]
  contas: Conta[]
  lancamentos: Lancamento[]
  parcelados: Parcelado[]
  recorrentes: Recorrente[]
  regras: Regra[]
}
