export type CharacterClassId =
  | 'classico_equilibrado'
  | 'estrategista'
  | 'mercador'
  | 'guardiao'
  | 'oraculo';

export interface CharacterClassSpec {
  id: CharacterClassId;
  nome: string;
  icone: string;
  titulo: string;
  bonusResumo: string;
  equilibrioResumo: string;
  descricaoCompleta: string;
  modificadores: {
    saldoInicialDeltaPct: number;
    passagemInicioDelta: number;
    descontoPrimeiraCompraPct: number;
    bonusAluguelConstruidoPct: number;
    custoConstrucaoDeltaPct: number;
    descontoFiancaPct: number;
    deltaOraculoPositivo: number;
    penalidadeOraculoNegativoPct: number;
  };
}

export const CHARACTER_CLASSES: CharacterClassSpec[] = [
  {
    id: 'classico_equilibrado',
    nome: 'Campeão Clássico',
    icone: '⚖️',
    titulo: 'Padrão Simétrico',
    bonusResumo: 'Atributos padrão sem alteradores',
    equilibrioResumo: 'Nenhuma penalidade ou desvio de regra',
    descricaoCompleta:
      'Preserva 100% da matemática clássica dos Deuses, ideal para disputas puras e torneios.',
    modificadores: {
      saldoInicialDeltaPct: 0,
      passagemInicioDelta: 0,
      descontoPrimeiraCompraPct: 0,
      bonusAluguelConstruidoPct: 0,
      custoConstrucaoDeltaPct: 0,
      descontoFiancaPct: 0,
      deltaOraculoPositivo: 0,
      penalidadeOraculoNegativoPct: 0
    }
  },
  {
    id: 'estrategista',
    nome: 'Estrategista',
    icone: '♟️',
    titulo: 'Mestre Tático',
    bonusResumo: '-10% na compra do 1º território adquirido',
    equilibrioResumo: '+10% de custo em eventos adversos do Oráculo',
    descricaoCompleta:
      'Excelente para garantir o primeiro domínio cedo no jogo, mas paga tributos ligeiramente maiores em infortúnios.',
    modificadores: {
      saldoInicialDeltaPct: 0,
      passagemInicioDelta: 0,
      descontoPrimeiraCompraPct: 0.1,
      bonusAluguelConstruidoPct: 0,
      custoConstrucaoDeltaPct: 0,
      descontoFiancaPct: 0,
      deltaOraculoPositivo: 0,
      penalidadeOraculoNegativoPct: 0.1
    }
  },
  {
    id: 'mercador',
    nome: 'Mercador Olímpico',
    icone: '🪙',
    titulo: 'Senhor das Rotas',
    bonusResumo: '+8% de aluguel em terras com 2+ Templos',
    equilibrioResumo: '-4% no tesouro inicial da partida',
    descricaoCompleta:
      'Brilha no meio e fim de jogo ao desenvolver construções, começando com reserva um pouco menor.',
    modificadores: {
      saldoInicialDeltaPct: -0.04,
      passagemInicioDelta: 0,
      descontoPrimeiraCompraPct: 0,
      bonusAluguelConstruidoPct: 0.08,
      custoConstrucaoDeltaPct: 0,
      descontoFiancaPct: 0,
      deltaOraculoPositivo: 0,
      penalidadeOraculoNegativoPct: 0
    }
  },
  {
    id: 'guardiao',
    nome: 'Guardião da Cidadela',
    icone: '🛡️',
    titulo: 'Defensor Resiliente',
    bonusResumo: '-25% fiança do Tártaro e +$30 nos Portões',
    equilibrioResumo: '+8% no custo de evolução de Templos',
    descricaoCompleta:
      'Sustenta voltas longas e escapa da prisão com menor custo, porém constrói em ritmo mais conservador.',
    modificadores: {
      saldoInicialDeltaPct: 0,
      passagemInicioDelta: 30,
      descontoPrimeiraCompraPct: 0,
      bonusAluguelConstruidoPct: 0,
      custoConstrucaoDeltaPct: 0.08,
      descontoFiancaPct: 0.25,
      deltaOraculoPositivo: 0,
      penalidadeOraculoNegativoPct: 0
    }
  },
  {
    id: 'oraculo',
    nome: 'Oráculo Místico',
    icone: '🔮',
    titulo: 'Arauto das Profecias',
    bonusResumo: '+$80 extras em bênçãos positivas de Delfos',
    equilibrioResumo: '-3% no tesouro inicial da partida',
    descricaoCompleta:
      'Aproveita melhor os favores divinos do Oráculo, aceitando um início mais enxuto.',
    modificadores: {
      saldoInicialDeltaPct: -0.03,
      passagemInicioDelta: 0,
      descontoPrimeiraCompraPct: 0,
      bonusAluguelConstruidoPct: 0,
      custoConstrucaoDeltaPct: 0,
      descontoFiancaPct: 0,
      deltaOraculoPositivo: 80,
      penalidadeOraculoNegativoPct: 0
    }
  }
];

export function getCharacterClassSpec(id: string | undefined | null): CharacterClassSpec {
  return (
    CHARACTER_CLASSES.find((c) => c.id === id) || CHARACTER_CLASSES[0]
  );
}

export function applyClassStartingBalance(
  baseBalance: number,
  classId: CharacterClassId | string,
  competitiveSymmetric: boolean
): number {
  if (competitiveSymmetric) return Math.round(baseBalance);
  const spec = getCharacterClassSpec(classId);
  return Math.max(1000, Math.round(baseBalance * (1 + spec.modificadores.saldoInicialDeltaPct)));
}

export function applyClassPropertyBuyCost(
  basePrice: number,
  classId: CharacterClassId | string,
  alreadyUsedFirstDiscount: boolean,
  competitiveSymmetric: boolean
): { cost: number; consumedFirstDiscount: boolean } {
  if (competitiveSymmetric || alreadyUsedFirstDiscount) {
    return { cost: basePrice, consumedFirstDiscount: false };
  }
  const spec = getCharacterClassSpec(classId);
  if (spec.modificadores.descontoPrimeiraCompraPct > 0) {
    return {
      cost: Math.max(100, Math.round(basePrice * (1 - spec.modificadores.descontoPrimeiraCompraPct))),
      consumedFirstDiscount: true
    };
  }
  return { cost: basePrice, consumedFirstDiscount: false };
}

export function applyClassUpgradeCost(
  baseCost: number,
  classId: CharacterClassId | string,
  competitiveSymmetric: boolean
): number {
  if (competitiveSymmetric) return baseCost;
  const spec = getCharacterClassSpec(classId);
  return Math.max(50, Math.round(baseCost * (1 + spec.modificadores.custoConstrucaoDeltaPct)));
}

export function applyClassRentBonus(
  baseRent: number,
  propertyLevel: number,
  ownerClassId: CharacterClassId | string,
  competitiveSymmetric: boolean
): number {
  if (competitiveSymmetric || propertyLevel < 2) return baseRent;
  const spec = getCharacterClassSpec(ownerClassId);
  return Math.round(baseRent * (1 + spec.modificadores.bonusAluguelConstruidoPct));
}

export function applyClassPassStartBonus(
  baseBonus: number,
  classId: CharacterClassId | string,
  competitiveSymmetric: boolean
): number {
  if (competitiveSymmetric) return baseBonus;
  const spec = getCharacterClassSpec(classId);
  return baseBonus + spec.modificadores.passagemInicioDelta;
}

export function applyClassBailCost(
  baseBail: number,
  classId: CharacterClassId | string,
  competitiveSymmetric: boolean
): number {
  if (competitiveSymmetric) return baseBail;
  const spec = getCharacterClassSpec(classId);
  return Math.max(50, Math.round(baseBail * (1 - spec.modificadores.descontoFiancaPct)));
}
