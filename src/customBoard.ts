import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { detectSoftwareWebGL, disposeSceneObject } from './pieces3d';

export type BoardThemeId =
  | 'mitologico'
  | 'medieval'
  | 'fantasia'
  | 'egipcio'
  | 'nordico'
  | 'futurista'
  | 'espacial'
  | 'pirata'
  | 'reinos_antigos'
  | 'civilizacoes'
  | 'aventura_retro'
  | 'supernatural'
  | 'custom';

export type BoardGridSize = 3 | 4 | 5 | 6 | 7; // 4x4=12, 5x5=16, 6x6=20, ou flexível 8..24
export type BoardTileType = 'inicio' | 'propriedade' | 'bencao' | 'prisao';
export type BoardSpacingId = 'compacto' | 'padrao' | 'amplo';
export type BoardPropKind = 'pilares' | 'cristais' | 'arvores' | 'nebulosa' | 'torres';

export type CustomOracleEffect =
  | 'saldo_delta'
  | 'imunidade'
  | 'avancar_casas'
  | 'ir_prisao'
  | 'tributo';

export interface CustomOracleCard {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'bencao' | 'maldicao';
  efeito: CustomOracleEffect;
  valor: number;
  quantidade: number;
  imagemDataUrl?: string;
}

export interface CustomBoardCardDeck {
  positiveGroupName: string;
  negativeGroupName: string;
  cards: CustomOracleCard[];
}

export interface CustomBoardTile {
  id: number;
  nome: string;
  descricao?: string;
  tipo: BoardTileType;
  icon: string;
  grupo?: string;
  imagemDataUrl?: string;
  valor: number;
  aluguel: number;
  temploCusto: number;
  temploAluguel: number;
  santuarioCusto: number;
  aluguelNiveis?: [number, number, number, number, number];
}

export interface CustomBoardConfig {
  id: string;
  nome: string;
  tema: BoardThemeId;
  customThemeName?: string;
  gridSide: number;
  tileCount: number;
  espacamento: BoardSpacingId;
  bordaArredondada: boolean;
  corPrimaria: string;
  corSecundaria: string;
  corFundo: string;
  corDestaque: string;
  decoracao3d: BoardPropKind;
  dicePresetId?: string;
  casas: CustomBoardTile[];
  cardDeck?: CustomBoardCardDeck;
  recommendedPieces?: string[];
  autor?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export interface BoardThemePresetMeta {
  id: BoardThemeId;
  nome: string;
  icone: string;
  descricao: string;
  corPrimaria: string;
  corSecundaria: string;
  corFundo: string;
  corDestaque: string;
  decoracao3d: BoardPropKind;
  premiumOnly?: boolean;
}

export const BOARD_THEME_CATALOG: BoardThemePresetMeta[] = [
  {
    id: 'mitologico',
    nome: 'Monte Olimpo Clássico',
    icone: '🏛️',
    descricao: 'Mármore dourado, templos olímpicos e tons celestiais.',
    corPrimaria: '#d97706',
    corSecundaria: '#1e293b',
    corFundo: '#020617',
    corDestaque: '#fbbf24',
    decoracao3d: 'pilares'
  },
  {
    id: 'medieval',
    nome: 'Bastilha Medieval',
    icone: '🏰',
    descricao: 'Pedra antiga, brasões escarlate e estandartes reais.',
    corPrimaria: '#b91c1c',
    corSecundaria: '#292524',
    corFundo: '#0c0a09',
    corDestaque: '#f59e0b',
    decoracao3d: 'torres'
  },
  {
    id: 'fantasia',
    nome: 'Domínios Arcanos',
    icone: '✨',
    descricao: 'Cidadelas élficas, portais etéreos e florestas mágicas.',
    corPrimaria: '#7c3aed',
    corSecundaria: '#1e1b4b',
    corFundo: '#09051a',
    corDestaque: '#38bdf8',
    decoracao3d: 'cristais'
  },
  {
    id: 'egipcio',
    nome: 'Arena dos Faraós',
    icone: '🏺',
    descricao: 'Pirâmides douradas, obeliscos do Nilo e sol eterno.',
    corPrimaria: '#ca8a04',
    corSecundaria: '#422006',
    corFundo: '#1c1003',
    corDestaque: '#fde047',
    decoracao3d: 'pilares'
  },
  {
    id: 'nordico',
    nome: 'Reinos de Asgard',
    icone: '🪓',
    descricao: 'Runas ancestrais, fiordes gelados e salões de Valhalla.',
    corPrimaria: '#0284c7',
    corSecundaria: '#1e293b',
    corFundo: '#061224',
    corDestaque: '#7dd3fc',
    decoracao3d: 'torres'
  },
  {
    id: 'futurista',
    nome: 'Cidadela Cibernética',
    icone: '⚡',
    descricao: 'Circuitos em neon ciano, aço escuro e energia sintética.',
    corPrimaria: '#06b6d4',
    corSecundaria: '#0f172a',
    corFundo: '#030712',
    corDestaque: '#22d3ee',
    decoracao3d: 'cristais'
  },
  {
    id: 'espacial',
    nome: 'Estação Nebulosa',
    icone: '🪐',
    descricao: 'Setores orbitais, violeta cósmico e cristais estelares.',
    corPrimaria: '#8b5cf6',
    corSecundaria: '#1e1b4b',
    corFundo: '#020617',
    corDestaque: '#c084fc',
    decoracao3d: 'nebulosa'
  },
  {
    id: 'pirata',
    nome: 'Marés dos Corsários',
    icone: '🏴‍☠️',
    descricao: 'Arquipélagos de tesouros, galeões e fortalezas navais.',
    corPrimaria: '#0d9488',
    corSecundaria: '#134e4a',
    corFundo: '#041f1e',
    corDestaque: '#fbbf24',
    decoracao3d: 'torres'
  },
  {
    id: 'reinos_antigos',
    nome: 'Reinos Antigos',
    icone: '👑',
    descricao: 'Impérios lendários, cidadelas de bronze e estradas reais.',
    corPrimaria: '#9f1239',
    corSecundaria: '#3f1d2b',
    corFundo: '#1a0810',
    corDestaque: '#fda4af',
    decoracao3d: 'pilares'
  },
  {
    id: 'civilizacoes',
    nome: 'Grandes Civilizações',
    icone: '🗿',
    descricao: 'Maravilhas históricas de todo o mundo antigo e clássico.',
    corPrimaria: '#b45309',
    corSecundaria: '#1c1917',
    corFundo: '#0c0a09',
    corDestaque: '#34d399',
    decoracao3d: 'pilares'
  },
  {
    id: 'aventura_retro',
    nome: 'Reino dos Blocos (Original)',
    icone: '🟩',
    descricao: 'Inspiração estética em consoles clássicos com cenários 100% originais.',
    corPrimaria: '#16a34a',
    corSecundaria: '#14532d',
    corFundo: '#052e16',
    corDestaque: '#facc15',
    decoracao3d: 'arvores'
  },
  {
    id: 'supernatural',
    nome: 'Sobrenatural — Winchester',
    icone: '🕯️',
    descricao: 'Estradas sombrias, bunkers arcanos, encruzilhadas e batalhas entre Céu e Inferno.',
    corPrimaria: '#991b1b',
    corSecundaria: '#18181b',
    corFundo: '#09090b',
    corDestaque: '#f59e0b',
    decoracao3d: 'torres'
  },
  {
    id: 'custom',
    nome: 'Criar meu próprio tema',
    icone: '✨',
    descricao: 'Tema 100% autoral com nome personalizado, paleta livre e casas flexíveis (8 a 24).',
    corPrimaria: '#0ea5e9',
    corSecundaria: '#1e1b4b',
    corFundo: '#030712',
    corDestaque: '#f472b6',
    decoracao3d: 'cristais'
  }
];

const DEFAULT_GROUPS = ['Fronteiras', 'Abismos', 'Sagrados', 'Supremos'];

const THEME_TILE_POOLS: Record<BoardThemeId, Array<{ nome: string; icon: string; grupo?: string }>> = {
  mitologico: [
    { nome: 'Labirinto de Creta', icon: '🐂', grupo: 'Fronteiras' },
    { nome: 'Floresta de Ártemis', icon: '🏹', grupo: 'Fronteiras' },
    { nome: 'Submundo de Hades', icon: '💀', grupo: 'Abismos & Mares' },
    { nome: 'Atlântida', icon: '🔱', grupo: 'Abismos & Mares' },
    { nome: 'Templo de Apolo', icon: '☀️', grupo: 'Sagrados' },
    { nome: 'Campos Elísios', icon: '🌾', grupo: 'Sagrados' },
    { nome: 'Ilha de Rhodes', icon: '⛵', grupo: 'Supremos' },
    { nome: 'Monte Olimpo', icon: '⛰️', grupo: 'Supremos' },
    { nome: 'Forja de Hefesto', icon: '🔨', grupo: 'Forjas' },
    { nome: 'Acadêmia de Atenas', icon: '🦉', grupo: 'Forjas' },
    { nome: 'Jardim das Hespérides', icon: '🍎', grupo: 'Relíquias' },
    { nome: 'Vinha de Dionísio', icon: '🍷', grupo: 'Relíquias' },
    { nome: 'Cidadela de Esparta', icon: '🛡️', grupo: 'Bastilha' },
    { nome: 'Farol do Egeu', icon: '🔥', grupo: 'Bastilha' }
  ],
  medieval: [
    { nome: 'Vila do Ferreiro', icon: '⚒️', grupo: 'Condado' },
    { nome: 'Bosque Real', icon: '🌲', grupo: 'Condado' },
    { nome: 'Muralha Norte', icon: '🧱', grupo: 'Guarnição' },
    { nome: 'Porto dos Galeões', icon: '⚓', grupo: 'Guarnição' },
    { nome: 'Catedral Dourada', icon: '⛪', grupo: 'Coroa' },
    { nome: 'Campos de Justa', icon: '🏇', grupo: 'Coroa' },
    { nome: 'Torre do Alquimista', icon: '⚗️', grupo: 'Soberania' },
    { nome: 'Castelo Soberano', icon: '🏰', grupo: 'Soberania' },
    { nome: 'Guilda dos Mercadores', icon: '🪙' },
    { nome: 'Passo da Montanha', icon: '🏔️' },
    { nome: 'Salão do Banquete', icon: '🍖' },
    { nome: 'Abadia Antiga', icon: '📜' },
    { nome: 'Forte da Fronteira', icon: '🗡️' },
    { nome: 'Trono da Coroa', icon: '👑' }
  ],
  fantasia: [
    { nome: 'Bosque Élfico', icon: '🌿', grupo: 'Floresta Alta' },
    { nome: 'Fonte das Fadas', icon: '🧚', grupo: 'Floresta Alta' },
    { nome: 'Torre de Safira', icon: '🔮', grupo: 'Arcano' },
    { nome: 'Biblioteca Astral', icon: '📖', grupo: 'Arcano' },
    { nome: 'Vale dos Dragões', icon: '🐉', grupo: 'Forja Rúnica' },
    { nome: 'Mina de Mitril', icon: '💎', grupo: 'Forja Rúnica' },
    { nome: 'Cidadela Etérea', icon: '🌌', grupo: 'Eterno' },
    { nome: 'Santuário de Prata', icon: '🌙', grupo: 'Eterno' },
    { nome: 'Bastilha de Rubi', icon: '🗡️' },
    { nome: 'Pico dos Grifos', icon: '🦅' },
    { nome: 'Ponte Arco-Íris', icon: '🌈' },
    { nome: 'Portal Antigo', icon: '🌀' },
    { nome: 'Jardim Lunar', icon: '🪷' },
    { nome: 'Coroa Celestial', icon: '👑' }
  ],
  egipcio: [
    { nome: 'Oásis de Siwa', icon: '🌴', grupo: 'Delta do Nilo' },
    { nome: 'Docas de Mênfis', icon: '⛵', grupo: 'Delta do Nilo' },
    { nome: 'Templo de Karnak', icon: '🏛️', grupo: 'Tebas' },
    { nome: 'Obelisco de Luxor', icon: '🗼', grupo: 'Tebas' },
    { nome: 'Esfinge Eterna', icon: '🦁', grupo: 'Gizé' },
    { nome: 'Pirâmide de Rá', icon: '🔺', grupo: 'Gizé' },
    { nome: 'Vale dos Reis', icon: '🏺', grupo: 'Dinastia' },
    { nome: 'Trono de Hórus', icon: '🦅', grupo: 'Dinastia' },
    { nome: 'Areias de Núbia', icon: '🏜️' },
    { nome: 'Jardim de Ísis', icon: '🪷' },
    { nome: 'Câmara Solar', icon: '☀️' },
    { nome: 'Salão de Anúbis', icon: '⚖️' },
    { nome: 'Túmulo Dourado', icon: '🪙' },
    { nome: 'Faro de Alexandria', icon: '🔥' }
  ],
  nordico: [
    { nome: 'Porto de Midgard', icon: '⛵', grupo: 'Fiordes' },
    { nome: 'Bosque de Freya', icon: '🌲', grupo: 'Fiordes' },
    { nome: 'Forja dos Anões', icon: '🔨', grupo: 'Nidavellir' },
    { nome: 'Salão de Mímir', icon: '🦉', grupo: 'Nidavellir' },
    { nome: 'Ponte Bifröst', icon: '🌈', grupo: 'Asgard' },
    { nome: 'Fortaleza de Thor', icon: '⚡', grupo: 'Asgard' },
    { nome: 'Árvore Yggdrasil', icon: '🌳', grupo: 'Valhalla' },
    { nome: 'Salão de Valhalla', icon: '🛡️', grupo: 'Valhalla' },
    { nome: 'Montes de Jotunheim', icon: '❄️' },
    { nome: 'Trono de Odin', icon: '👑' },
    { nome: 'Pedra das Runas', icon: '🪨' },
    { nome: 'Costa dos Drakkars', icon: '⚓' },
    { nome: 'Pico Gelado', icon: '🏔️' },
    { nome: 'Chama de Surtur', icon: '🔥' }
  ],
  futurista: [
    { nome: 'Torre Neon Alfa', icon: '🌆', grupo: 'Distrito Neon' },
    { nome: 'Reator Quântico', icon: '⚛️', grupo: 'Distrito Neon' },
    { nome: 'Malha Neural', icon: '💠', grupo: 'Núcleo Cyber' },
    { nome: 'Porto Orbital', icon: '🛸', grupo: 'Núcleo Cyber' },
    { nome: 'Cúpula Sintética', icon: '🔷', grupo: 'Cidadela' },
    { nome: 'Bastilha de Plasma', icon: '⚡', grupo: 'Cidadela' },
    { nome: 'Setor Holográfico', icon: '📡', grupo: 'Apex' },
    { nome: 'Núcleo Central', icon: '🔋', grupo: 'Apex' },
    { nome: 'Docks Magneto', icon: '🧲' },
    { nome: 'Arquivo Ciber', icon: '💾' },
    { nome: 'Vórtice Fotônico', icon: '✨' },
    { nome: 'Matriz Solaris', icon: '🔆' },
    { nome: 'Ponte de Dados', icon: '🌐' },
    { nome: 'Cidadela Apex', icon: '🏙️' }
  ],
  espacial: [
    { nome: 'Anel de Satélite', icon: '🛰️', grupo: 'Órbita Baixa' },
    { nome: 'Mina de Asteroides', icon: '☄️', grupo: 'Órbita Baixa' },
    { nome: 'Base Lunar Orion', icon: '🌙', grupo: 'Setor Lunar' },
    { nome: 'Cinturão de Órion', icon: '✨', grupo: 'Setor Lunar' },
    { nome: 'Observatório Pulsar', icon: '🔭', grupo: 'Nebulosa' },
    { nome: 'Jardim Hidropônico', icon: '🌱', grupo: 'Nebulosa' },
    { nome: 'Dobra Hiperespaço', icon: '🌀', grupo: 'Galáxia' },
    { nome: 'Estação Centauri', icon: '🚀', grupo: 'Galáxia' },
    { nome: 'Nebulosa Violeta', icon: '🌌' },
    { nome: 'Escudo Magnetar', icon: '🛡️' },
    { nome: 'Coletor Solar', icon: '☀️' },
    { nome: 'Câmara Criogenia', icon: '❄️' },
    { nome: 'Portal Estelar', icon: '🪐' },
    { nome: 'Cúpula Galáctica', icon: '🌟' }
  ],
  pirata: [
    { nome: 'Enseada da Neblina', icon: '🏝️', grupo: 'Baía Sul' },
    { nome: 'Docas do Capitão', icon: '⚓', grupo: 'Baía Sul' },
    { nome: 'Forte Tortuga', icon: '🏴‍☠️', grupo: 'Corsários' },
    { nome: 'Taberna Dourada', icon: '🪙', grupo: 'Corsários' },
    { nome: 'Recife das Sereias', icon: '🧜', grupo: 'Sete Mares' },
    { nome: 'Galeão Fantasma', icon: '⛵', grupo: 'Sete Mares' },
    { nome: 'Ilha do Tesouro', icon: '💎', grupo: 'Supremos' },
    { nome: 'Cidadela do Farol', icon: '🧭', grupo: 'Supremos' },
    { nome: 'Caverna dos Rubis', icon: '🪨' },
    { nome: 'Atol Esmeralda', icon: '🦜' },
    { nome: 'Estaleiro Real', icon: '🔨' },
    { nome: 'Canhão da Costa', icon: '💣' },
    { nome: 'Coroa dos Mares', icon: '👑' },
    { nome: 'Fosso do Kraken', icon: '🐙' }
  ],
  reinos_antigos: [
    { nome: 'Portão da Babilônia', icon: '🏛️', grupo: 'Mesopotâmia' },
    { nome: 'Jardins Suspensos', icon: '🌿', grupo: 'Mesopotâmia' },
    { nome: 'Cidadela de Persépolis', icon: '🦅', grupo: 'Império Real' },
    { nome: 'Estrada da Seda', icon: '🐪', grupo: 'Império Real' },
    { nome: 'Muralha de Tróia', icon: '🛡️', grupo: 'Egeu' },
    { nome: 'Porto de Cartago', icon: '⛵', grupo: 'Egeu' },
    { nome: 'Fórum Imperial', icon: '⚖️', grupo: 'Soberanos' },
    { nome: 'Acadêmia Clássica', icon: '📜', grupo: 'Soberanos' },
    { nome: 'Arenas de Bronze', icon: '⚔️' },
    { nome: 'Templo da Aurora', icon: '☀️' },
    { nome: 'Tesouro Antigo', icon: '🪙' },
    { nome: 'Coliseu Dourado', icon: '🏟️' },
    { nome: 'Cidadela Alta', icon: '👑' },
    { nome: 'Farol Eterno', icon: '🔥' }
  ],
  civilizacoes: [
    { nome: 'Machu Picchu', icon: '🏔️', grupo: 'Andes' },
    { nome: 'Templo do Sol Inca', icon: '☀️', grupo: 'Andes' },
    { nome: 'Chichén Itzá', icon: '🔺', grupo: 'Mesoamérica' },
    { nome: 'Observatório Maia', icon: '🔭', grupo: 'Mesoamérica' },
    { nome: 'Muralha Imperial', icon: '🧱', grupo: 'Oriente' },
    { nome: 'Palácio de Jade', icon: '🐉', grupo: 'Oriente' },
    { nome: 'Petra Esculpida', icon: '🏜️', grupo: 'Maravilhas' },
    { nome: 'Angkor Wat', icon: '🏛️', grupo: 'Maravilhas' },
    { nome: 'Taj Dourado', icon: '🕌' },
    { nome: 'Biblioteca Antiga', icon: '📚' },
    { nome: 'Rota Marítima', icon: '⛵' },
    { nome: 'Acadêmia Astral', icon: '⭐' },
    { nome: 'Jardim Milenar', icon: '🌸' },
    { nome: 'Monumento Supremo', icon: '🗿' }
  ],
  aventura_retro: [
    { nome: 'Vale Verdejante', icon: '🌿', grupo: 'Planalto' },
    { nome: 'Colina dos Cristais', icon: '💎', grupo: 'Planalto' },
    { nome: 'Pontes Flutuantes', icon: '🌉', grupo: 'Nuvens' },
    { nome: 'Lagoa Cintilante', icon: '💧', grupo: 'Nuvens' },
    { nome: 'Gruta dos Ecos', icon: '🪨', grupo: 'Cavernas' },
    { nome: 'Fábrica Engrenagens', icon: '⚙️', grupo: 'Cavernas' },
    { nome: 'Fortaleza do Pico', icon: '🚩', grupo: 'Cidadela' },
    { nome: 'Cidadela Celeste', icon: '🏆', grupo: 'Cidadela' },
    { nome: 'Planície Dourada', icon: '🌻' },
    { nome: 'Cascata Arcana', icon: '🌊' },
    { nome: 'Bosque Cogumelos', icon: '🍄' },
    { nome: 'Deserto das Ruínas', icon: '🏜️' },
    { nome: 'Farol dos Ventos', icon: '🧭' },
    { nome: 'Trilha das Nuvens', icon: '☁️' }
  ],
  supernatural: [
    { nome: 'Casa dos Homens de Letras', icon: '📜', grupo: 'Casas de Caça' },
    { nome: 'Lawrence, Kansas', icon: '🏡', grupo: 'Origens' },
    { nome: 'Roadhouse da Ellen', icon: '🥃', grupo: 'Abrigos' },
    { nome: '1º Bunker Homens de Letras', icon: '🗝️', grupo: 'Bunkers' },
    { nome: '2º Bunker Homens de Letras', icon: '🔐', grupo: 'Bunkers' },
    { nome: 'Cemitério Stull', icon: '🪦', grupo: 'Confrontos' },
    { nome: 'Inferno', icon: '🔥', grupo: 'Reinos' },
    { nome: 'Paraíso', icon: '🕊️', grupo: 'Reinos' },
    { nome: 'Purgatório', icon: '🌫️', grupo: 'Dimensões' },
    { nome: 'Santuário de Bobby', icon: '📚', grupo: 'Abrigos' },
    { nome: 'Encruzilhada dos Pactos', icon: '🕯️', grupo: 'Rituais' },
    { nome: 'Hotel de Sioux Falls', icon: '🏚️', grupo: 'Estrada' },
    { nome: 'Igreja de Carthage', icon: '⛪', grupo: 'Rituais' },
    { nome: 'Torre do Anjo Caído', icon: '🪽', grupo: 'Dimensões' },
    { nome: 'Armazém de Relíquias', icon: '🗡️', grupo: 'Casas de Caça' },
    { nome: 'Lago Manitoc', icon: '🌊', grupo: 'Confrontos' }
  ],
  custom: [
    { nome: 'Marco Pioneiro', icon: '🗺️', grupo: 'Horizonte' },
    { nome: 'Praça da Alvorada', icon: '🌅', grupo: 'Horizonte' },
    { nome: 'Porto das Lendas', icon: '⚓', grupo: 'Fronteira Sul' },
    { nome: 'Mirante Esmeralda', icon: '🌿', grupo: 'Fronteira Sul' },
    { nome: 'Santuário Dourado', icon: '🏛️', grupo: 'Cidadela' },
    { nome: 'Bastião do Sol', icon: '☀️', grupo: 'Cidadela' },
    { nome: 'Coroa das Alturas', icon: '👑', grupo: 'Ápice' },
    { nome: 'Trono Criativo', icon: '✨', grupo: 'Ápice' },
    { nome: 'Vale das Cachoeiras', icon: '🌊' },
    { nome: 'Forja Ancestral', icon: '🔥' },
    { nome: 'Jardim Estelar', icon: '🌟' },
    { nome: 'Torre dos Ventos', icon: '🌬️' },
    { nome: 'Arena Real', icon: '⚔️' },
    { nome: 'Portão Místico', icon: '🔮' }
  ]
};

export const BOARD_CARD_DECK_PRESETS: Record<string, CustomBoardCardDeck> = {
  mitologico: {
    positiveGroupName: 'Bênçãos do Olimpo',
    negativeGroupName: 'Provações de Ares',
    cards: [
      { id: 'mit_1', titulo: 'Bênção de Hermes', descricao: 'Os mensageiros divinos entregam um tesouro sagrado.', tipo: 'bencao', efeito: 'saldo_delta', valor: 400, quantidade: 2 },
      { id: 'mit_2', titulo: 'Sabedoria de Atena', descricao: 'Escudo divino protege contra a próxima taxa de aluguel.', tipo: 'bencao', efeito: 'imunidade', valor: 1, quantidade: 1 },
      { id: 'mit_3', titulo: 'Fúria de Ares', descricao: 'Conflito nas fronteiras exige tributo imediato aos templos.', tipo: 'maldicao', efeito: 'saldo_delta', valor: -250, quantidade: 2 },
      { id: 'mit_4', titulo: 'Mar de Poseidon', descricao: 'Uma onda colossal impulsiona sua peça 2 casas adiante.', tipo: 'bencao', efeito: 'avancar_casas', valor: 2, quantidade: 1 }
    ]
  },
  supernatural: {
    positiveGroupName: 'Bênçãos de Chuck',
    negativeGroupName: 'Maldições de Crowley',
    cards: [
      { id: 'sup_1', titulo: 'Bênção de Chuck: Proteção Arcana', descricao: 'Um sinal angelical reforça seus suprimentos de caça (+$450).', tipo: 'bencao', efeito: 'saldo_delta', valor: 450, quantidade: 2 },
      { id: 'sup_2', titulo: 'Bênção de Chuck: Graça de Castiel', descricao: 'Imunidade divina contra a próxima cobrança de território.', tipo: 'bencao', efeito: 'imunidade', valor: 1, quantidade: 2 },
      { id: 'sup_3', titulo: 'Bênção de Chuck: Atalho na Rota 66', descricao: 'Caminho livre na estrada! Avance 3 casas imediatamente.', tipo: 'bencao', efeito: 'avancar_casas', valor: 3, quantidade: 1 },
      { id: 'sup_4', titulo: 'Maldição de Crowley: Pacto de Encruzilhada', descricao: 'O Rei do Inferno cobra os juros do contrato (-$350).', tipo: 'maldicao', efeito: 'saldo_delta', valor: -350, quantidade: 2 },
      { id: 'sup_5', titulo: 'Maldição de Crowley: Selo da Armadilha', descricao: 'Você caiu em uma armadilha demoníaca e foi enviado para a Jaula!', tipo: 'maldicao', efeito: 'ir_prisao', valor: 1, quantidade: 1 },
      { id: 'sup_6', titulo: 'Maldição de Crowley: Tributo Infernal', descricao: 'Demônios cobram pedágio sombrio pelos portais (-$220).', tipo: 'maldicao', efeito: 'tributo', valor: 220, quantidade: 1 }
    ]
  }
};

export function createDefaultCardDeckForTheme(tema: BoardThemeId): CustomBoardCardDeck {
  const preset = BOARD_CARD_DECK_PRESETS[tema] || BOARD_CARD_DECK_PRESETS.mitologico;
  return {
    positiveGroupName: preset.positiveGroupName,
    negativeGroupName: preset.negativeGroupName,
    cards: preset.cards.map((c) => ({ ...c }))
  };
}

export function computeFlexibleBoardGrid(tileCount: number): { cols: number; rows: number; gridSide: number } {
  const n = Math.max(8, Math.min(24, Math.round(tileCount || 12)));
  if (n <= 8) return { cols: 3, rows: 3, gridSide: 3 };
  if (n <= 10) return { cols: 4, rows: 3, gridSide: 4 };
  if (n <= 12) return { cols: 4, rows: 4, gridSide: 4 };
  if (n <= 14) return { cols: 5, rows: 4, gridSide: 5 };
  if (n <= 16) return { cols: 5, rows: 5, gridSide: 5 };
  if (n <= 18) return { cols: 6, rows: 5, gridSide: 6 };
  if (n <= 20) return { cols: 6, rows: 6, gridSide: 6 };
  if (n <= 22) return { cols: 7, rows: 6, gridSide: 7 };
  return { cols: 7, rows: 7, gridSide: 7 };
}

export function tileCountForGridSide(gridSide: number): number {
  if (gridSide === 7) return 24;
  if (gridSide === 6) return 20;
  if (gridSide === 5) return 16;
  if (gridSide === 3) return 8;
  return 12;
}

export function buildEconomicLevels(baseValue: number): {
  aluguel: number;
  temploCusto: number;
  temploAluguel: number;
  santuarioCusto: number;
  aluguelNiveis: [number, number, number, number, number];
} {
  const val = Math.max(400, Math.min(5000, Math.round(baseValue / 50) * 50));
  const baseRent = Math.max(50, Math.round(val * 0.13));
  const temploCusto = Math.max(250, Math.round((val * 0.55) / 50) * 50);
  const t1 = Math.round(baseRent * 2.2);
  const t2 = Math.round(baseRent * 3.8);
  const t3 = Math.round(baseRent * 5.6);
  const sup = Math.round(baseRent * 8.4);
  const santuarioCusto = Math.max(700, Math.round((val * 1.35) / 50) * 50);
  return {
    aluguel: baseRent,
    temploCusto,
    temploAluguel: t1,
    santuarioCusto,
    aluguelNiveis: [baseRent, t1, t2, t3, sup]
  };
}

export function createBoardFromThemePreset(
  tema: BoardThemeId,
  gridSideOrCount: number = 4,
  customName?: string,
  customThemeName?: string
): CustomBoardConfig {
  const meta = BOARD_THEME_CATALOG.find((t) => t.id === tema) || BOARD_THEME_CATALOG[0];
  const tileCount =
    gridSideOrCount >= 8 && gridSideOrCount <= 24
      ? Math.round(gridSideOrCount)
      : tileCountForGridSide(gridSideOrCount);
  const { gridSide } = computeFlexibleBoardGrid(tileCount);
  const prisonIdx = Math.floor(tileCount / 2);
  const blessA = Math.max(2, Math.floor(tileCount / 3));
  const blessB = tileCount >= 12 ? Math.floor((tileCount * 3) / 4) : -1;
  const pool = THEME_TILE_POOLS[tema] || THEME_TILE_POOLS.mitologico;

  const casas: CustomBoardTile[] = [];
  let propCounter = 0;

  for (let i = 0; i < tileCount; i++) {
    if (i === 0) {
      casas.push({
        id: 0,
        nome:
          tema === 'supernatural'
            ? 'Garagem dos Winchester'
            : tema === 'futurista'
            ? 'Portal Central'
            : tema === 'espacial'
            ? 'Doca Zero'
            : tema === 'custom'
            ? 'Marco Zero'
            : 'Portões do Olimpo',
        descricao: 'Casa inicial da jornada (+ $200 ao passar).',
        tipo: 'inicio',
        icon: tema === 'supernatural' ? '🗝️' : '🏛️',
        valor: 0,
        aluguel: 0,
        temploCusto: 0,
        temploAluguel: 0,
        santuarioCusto: 0
      });
    } else if (i === prisonIdx) {
      casas.push({
        id: i,
        nome:
          tema === 'supernatural'
            ? 'Jaula de Lúcifer'
            : tema === 'futurista'
            ? 'Quarentena Cyber'
            : tema === 'espacial'
            ? 'Órbita Tártaro'
            : tema === 'custom'
            ? 'Prisão / Exílio'
            : 'Tártaro',
        descricao: 'Penalidade temporária até pagar fiança ou tirar 6.',
        tipo: 'prisao',
        icon: tema === 'supernatural' ? '⛓️' : '🔥',
        valor: 0,
        aluguel: 0,
        temploCusto: 0,
        temploAluguel: 0,
        santuarioCusto: 0
      });
    } else if (i === blessA || (blessB > 0 && i === blessB && blessB !== prisonIdx)) {
      casas.push({
        id: i,
        nome:
          tema === 'supernatural'
            ? 'Oráculo de Chuck & Crowley'
            : tema === 'futurista'
            ? 'Terminal Oráculo'
            : tema === 'espacial'
            ? 'Baliza Cósmica'
            : 'Oráculo Sagrado',
        descricao:
          tema === 'supernatural'
            ? 'Sorteie entre Bênçãos de Chuck e Maldições de Crowley.'
            : 'Evento especial de sorte ou desafio.',
        tipo: 'bencao',
        icon: tema === 'supernatural' ? '🕯️' : '🔮',
        valor: 0,
        aluguel: 0,
        temploCusto: 0,
        temploAluguel: 0,
        santuarioCusto: 0
      });
    } else {
      const template = pool[propCounter % pool.length];
      const baseVal = 600 + propCounter * 200;
      const econ = buildEconomicLevels(baseVal);
      const grupo = template.grupo || DEFAULT_GROUPS[Math.floor(propCounter / 2) % DEFAULT_GROUPS.length];
      casas.push({
        id: i,
        nome: template.nome,
        descricao: '',
        tipo: 'propriedade',
        icon: template.icon,
        grupo,
        valor: baseVal,
        ...econ
      });
      propCounter++;
    }
  }

  const now = Date.now();
  return {
    id: `board_${tema}_${tileCount}c_${now}`,
    nome: (customName || `${tema === 'custom' && customThemeName ? customThemeName : meta.nome} (${tileCount} casas)`).substring(0, 36),
    tema,
    ...(tema === 'custom' ? { customThemeName: (customThemeName || 'Meu Universo Autoral').substring(0, 32) } : {}),
    gridSide,
    tileCount,
    espacamento: 'padrao',
    bordaArredondada: true,
    corPrimaria: meta.corPrimaria,
    corSecundaria: meta.corSecundaria,
    corFundo: meta.corFundo,
    corDestaque: meta.corDestaque,
    decoracao3d: meta.decoracao3d,
    casas,
    cardDeck: createDefaultCardDeckForTheme(tema),
    ...(tema === 'supernatural'
      ? {
          recommendedPieces: [
            'impala_1967',
            'dean_winchester',
            'sam_winchester',
            'castiel',
            'jack_kline',
            'lucifer',
            'crowley'
          ]
        }
      : {}),
    criadoEm: now,
    atualizadoEm: now
  };
}

export function resizeCustomBoardTiles(
  board: CustomBoardConfig,
  nextGridOrCount: number
): CustomBoardConfig {
  if (!board || !Array.isArray(board.casas)) {
    return createBoardFromThemePreset('mitologico', nextGridOrCount);
  }
  const targetCount =
    nextGridOrCount >= 8 && nextGridOrCount <= 24
      ? Math.round(nextGridOrCount)
      : tileCountForGridSide(nextGridOrCount);
  const clampedTarget = Math.max(8, Math.min(24, targetCount));
  const pool = THEME_TILE_POOLS[board.tema] || THEME_TILE_POOLS.mitologico;
  const usedNames = new Set(board.casas.map((c) => String(c.nome || '').trim().toLowerCase()));

  let nextCasas = board.casas.slice(0, clampedTarget).map((c, idx) => ({ ...c, id: idx }));

  if (nextCasas.length < clampedTarget) {
    let poolCursor = 0;
    while (nextCasas.length < clampedTarget) {
      const idx = nextCasas.length;
      let chosen = pool[poolCursor % pool.length];
      let tries = 0;
      while (usedNames.has(chosen.nome.toLowerCase()) && tries < pool.length) {
        poolCursor++;
        tries++;
        chosen = pool[poolCursor % pool.length];
      }
      const uniqueName = usedNames.has(chosen.nome.toLowerCase())
        ? `${chosen.nome.substring(0, 18)} ${idx}`
        : chosen.nome;
      usedNames.add(uniqueName.toLowerCase());
      const baseVal = 600 + ((idx % 10) * 200);
      const econ = buildEconomicLevels(baseVal);
      nextCasas.push({
        id: idx,
        nome: uniqueName,
        descricao: '',
        tipo: 'propriedade',
        icon: chosen.icon,
        grupo: chosen.grupo || DEFAULT_GROUPS[Math.floor(idx / 2) % DEFAULT_GROUPS.length],
        valor: baseVal,
        ...econ
      });
      poolCursor++;
    }
  }

  // Ensure prison tile still exists if truncation removed it
  if (!nextCasas.some((c) => c.tipo === 'prisao')) {
    const prisonIdx = Math.min(nextCasas.length - 1, Math.max(1, Math.floor(nextCasas.length / 2)));
    nextCasas[prisonIdx] = {
      ...nextCasas[prisonIdx],
      id: prisonIdx,
      nome: board.tema === 'supernatural' ? 'Jaula de Lúcifer' : 'Tártaro',
      tipo: 'prisao',
      icon: board.tema === 'supernatural' ? '⛓️' : '🔥',
      valor: 0,
      aluguel: 0,
      temploCusto: 0,
      temploAluguel: 0,
      santuarioCusto: 0
    };
  }

  const { gridSide } = computeFlexibleBoardGrid(nextCasas.length);
  return {
    ...board,
    gridSide,
    tileCount: nextCasas.length,
    casas: nextCasas,
    atualizadoEm: Date.now()
  };
}

export function addTileToCustomBoard(board: CustomBoardConfig): CustomBoardConfig {
  if (!board || !Array.isArray(board.casas) || board.casas.length >= 24) return board;
  const idx = board.casas.length;
  const baseVal = 800 + ((idx % 6) * 200);
  const econ = buildEconomicLevels(baseVal);
  const newTile: CustomBoardTile = {
    id: idx,
    nome: `Nova Terra ${idx}`,
    descricao: '',
    tipo: 'propriedade',
    icon: '🏛️',
    grupo: DEFAULT_GROUPS[Math.floor(idx / 3) % DEFAULT_GROUPS.length],
    valor: baseVal,
    ...econ
  };
  const nextCasas = [...board.casas, newTile].map((c, i) => ({ ...c, id: i }));
  const { gridSide } = computeFlexibleBoardGrid(nextCasas.length);
  return {
    ...board,
    gridSide,
    tileCount: nextCasas.length,
    casas: nextCasas,
    atualizadoEm: Date.now()
  };
}

export function removeTileFromCustomBoard(board: CustomBoardConfig, idx: number): CustomBoardConfig {
  if (!board || !Array.isArray(board.casas) || board.casas.length <= 8 || idx <= 0 || idx >= board.casas.length) {
    return board;
  }
  const nextCasas = board.casas.filter((_, i) => i !== idx).map((c, i) => ({ ...c, id: i }));
  const { gridSide } = computeFlexibleBoardGrid(nextCasas.length);
  return {
    ...board,
    gridSide,
    tileCount: nextCasas.length,
    casas: nextCasas,
    atualizadoEm: Date.now()
  };
}

export function validateCustomBoardConfig(board: unknown): {
  ok: boolean;
  erro?: string;
  normalized?: CustomBoardConfig;
} {
  if (!board || typeof board !== 'object') {
    return { ok: false, erro: 'Configuração de tabuleiro inválida.' };
  }
  const b = board as Partial<CustomBoardConfig>;
  const nome = String(b.nome || '').replace(/[<>"'`]/g, '').trim().substring(0, 36);
  if (nome.length < 3) {
    return { ok: false, erro: 'O nome do tabuleiro deve ter entre 3 e 36 caracteres.' };
  }

  const rawCasas = Array.isArray(b.casas) ? b.casas : [];
  if (rawCasas.length < 8 || rawCasas.length > 24) {
    return {
      ok: false,
      erro: 'O tabuleiro personalizado deve ter entre 8 e 24 casas ao redor do perímetro.'
    };
  }
  const expectedCount = rawCasas.length;
  const { gridSide } = computeFlexibleBoardGrid(expectedCount);

  let propertyCount = 0;
  let hasStart = false;
  let hasPrison = false;
  const normalizedTiles: CustomBoardTile[] = [];

  for (let i = 0; i < expectedCount; i++) {
    const raw = rawCasas[i];
    if (!raw || typeof raw !== 'object') {
      return { ok: false, erro: `Casa #${i} inválida.` };
    }
    const tipo: BoardTileType =
      i === 0
        ? 'inicio'
        : raw.tipo === 'prisao' || raw.tipo === 'bencao' || raw.tipo === 'propriedade'
        ? raw.tipo
        : 'propriedade';

    if (tipo === 'inicio') hasStart = true;
    if (tipo === 'prisao') hasPrison = true;
    if (tipo === 'propriedade') propertyCount++;

    const tileName = String(raw.nome || `Casa ${i}`)
      .replace(/[<>"'`]/g, '')
      .trim()
      .substring(0, 26);
    if (tileName.length < 2) {
      return { ok: false, erro: `Nome da casa #${i} muito curto.` };
    }
    const descricao =
      typeof raw.descricao === 'string' && raw.descricao.trim().length > 0
        ? raw.descricao.replace(/[<>"'`]/g, '').trim().substring(0, 100)
        : undefined;

    const icon = String(raw.icon || '🏛️').replace(/[<>"'`]/g, '').trim().substring(0, 4) || '🏛️';
    const rawImg = typeof raw.imagemDataUrl === 'string' ? raw.imagemDataUrl.trim() : '';
    const imagemDataUrl =
      rawImg && /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(rawImg) && rawImg.length <= 48 * 1024
        ? rawImg
        : undefined;
    const grupo =
      typeof raw.grupo === 'string' && raw.grupo.trim().length > 0
        ? raw.grupo.replace(/[<>"'`]/g, '').trim().substring(0, 24)
        : DEFAULT_GROUPS[Math.floor(Math.max(0, propertyCount - 1) / 2) % DEFAULT_GROUPS.length];

    if (tipo === 'propriedade') {
      const val = Number(raw.valor);
      if (!Number.isFinite(val) || val < 400 || val > 5000) {
        return { ok: false, erro: `Valor da propriedade "${tileName}" deve ficar entre $400 e $5.000.` };
      }
      const econ = buildEconomicLevels(val);
      normalizedTiles.push({
        id: i,
        nome: tileName,
        ...(descricao ? { descricao } : {}),
        tipo: 'propriedade',
        icon,
        grupo,
        ...(imagemDataUrl ? { imagemDataUrl } : {}),
        valor: Math.round(val),
        aluguel: Number.isFinite(Number(raw.aluguel)) && Number(raw.aluguel) >= 40
          ? Math.min(Math.round(val * 0.45), Math.round(Number(raw.aluguel)))
          : econ.aluguel,
        temploCusto: Number.isFinite(Number(raw.temploCusto)) && Number(raw.temploCusto) >= 200
          ? Math.round(Number(raw.temploCusto))
          : econ.temploCusto,
        temploAluguel: Number.isFinite(Number(raw.temploAluguel)) && Number(raw.temploAluguel) >= 80
          ? Math.round(Number(raw.temploAluguel))
          : econ.temploAluguel,
        santuarioCusto: Number.isFinite(Number(raw.santuarioCusto)) && Number(raw.santuarioCusto) >= 500
          ? Math.round(Number(raw.santuarioCusto))
          : econ.santuarioCusto,
        aluguelNiveis: Array.isArray(raw.aluguelNiveis) && raw.aluguelNiveis.length === 5
          ? (raw.aluguelNiveis.map((n) => Math.max(40, Math.round(Number(n) || 40))) as [number, number, number, number, number])
          : econ.aluguelNiveis
      });
    } else {
      normalizedTiles.push({
        id: i,
        nome: tileName,
        ...(descricao ? { descricao } : {}),
        tipo,
        icon,
        ...(imagemDataUrl ? { imagemDataUrl } : {}),
        valor: 0,
        aluguel: 0,
        temploCusto: 0,
        temploAluguel: 0,
        santuarioCusto: 0
      });
    }
  }

  if (!hasStart) return { ok: false, erro: 'A casa 0 deve ser o Início.' };
  if (!hasPrison) return { ok: false, erro: 'O tabuleiro precisa ter pelo menos 1 casa de Prisão/Tártaro.' };
  if (propertyCount < 5) return { ok: false, erro: 'O tabuleiro precisa ter no mínimo 5 territórios compráveis.' };

  const hexOk = (v: unknown, fb: string) =>
    typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : fb;

  const validThemes: BoardThemeId[] = [
    'mitologico',
    'medieval',
    'fantasia',
    'egipcio',
    'nordico',
    'futurista',
    'espacial',
    'pirata',
    'reinos_antigos',
    'civilizacoes',
    'aventura_retro',
    'supernatural',
    'custom'
  ];
  const tema: BoardThemeId = validThemes.includes(b.tema as BoardThemeId) ? (b.tema as BoardThemeId) : 'mitologico';
  const customThemeName =
    tema === 'custom' && typeof b.customThemeName === 'string' && b.customThemeName.trim().length > 0
      ? b.customThemeName.replace(/[<>"'`]/g, '').trim().substring(0, 32)
      : tema === 'custom'
      ? 'Tema Autoral'
      : undefined;
  const validProps: BoardPropKind[] = ['pilares', 'cristais', 'arvores', 'nebulosa', 'torres'];
  const decoracao3d: BoardPropKind = validProps.includes(b.decoracao3d as BoardPropKind)
    ? (b.decoracao3d as BoardPropKind)
    : 'pilares';
  const espacamento: BoardSpacingId =
    b.espacamento === 'compacto' || b.espacamento === 'amplo' ? b.espacamento : 'padrao';

  let normalizedDeck: CustomBoardCardDeck | undefined;
  if (b.cardDeck && typeof b.cardDeck === 'object' && Array.isArray(b.cardDeck.cards)) {
    const validEffects: CustomOracleEffect[] = [
      'saldo_delta',
      'imunidade',
      'avancar_casas',
      'ir_prisao',
      'tributo'
    ];
    const cleanCards: CustomOracleCard[] = b.cardDeck.cards
      .slice(0, 24)
      .map((c, idx) => {
        const efeito: CustomOracleEffect = validEffects.includes(c?.efeito) ? c.efeito : 'saldo_delta';
        const tipo: 'bencao' | 'maldicao' = c?.tipo === 'maldicao' ? 'maldicao' : 'bencao';
        const rawImg = typeof c?.imagemDataUrl === 'string' ? c.imagemDataUrl.trim() : '';
        const safeImg =
          rawImg && /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(rawImg) && rawImg.length <= 48 * 1024
            ? rawImg
            : undefined;
        return {
          id: String(c?.id || `card_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 36) || `card_${idx}`,
          titulo: String(c?.titulo || `Carta ${idx + 1}`).replace(/[<>"'`]/g, '').trim().substring(0, 44) || `Carta ${idx + 1}`,
          descricao: String(c?.descricao || 'Evento especial do tabuleiro.').replace(/[<>"'`]/g, '').trim().substring(0, 140) || 'Evento especial.',
          tipo,
          efeito,
          valor: Math.max(-2500, Math.min(2500, Math.round(Number(c?.valor) || 0))),
          quantidade: Math.max(1, Math.min(6, Math.round(Number(c?.quantidade) || 1))),
          ...(safeImg ? { imagemDataUrl: safeImg } : {})
        };
      })
      .filter((c) => c.titulo.length >= 2);
    if (cleanCards.length > 0) {
      normalizedDeck = {
        positiveGroupName:
          String(b.cardDeck.positiveGroupName || 'Bênçãos').replace(/[<>"'`]/g, '').trim().substring(0, 36) || 'Bênçãos',
        negativeGroupName:
          String(b.cardDeck.negativeGroupName || 'Maldições').replace(/[<>"'`]/g, '').trim().substring(0, 36) || 'Maldições',
        cards: cleanCards
      };
    }
  }

  const recommendedPieces = Array.isArray(b.recommendedPieces)
    ? b.recommendedPieces
        .map((x) => String(x || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32))
        .filter(Boolean)
        .slice(0, 12)
    : undefined;

  const now = Date.now();
  return {
    ok: true,
    normalized: {
      id: String(b.id || `board_${now}`).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 48) || `board_${now}`,
      nome,
      tema,
      ...(customThemeName ? { customThemeName } : {}),
      gridSide,
      tileCount: expectedCount,
      espacamento,
      bordaArredondada: b.bordaArredondada !== false,
      corPrimaria: hexOk(b.corPrimaria, '#d97706'),
      corSecundaria: hexOk(b.corSecundaria, '#1e293b'),
      corFundo: hexOk(b.corFundo, '#020617'),
      corDestaque: hexOk(b.corDestaque, '#fbbf24'),
      decoracao3d,
      dicePresetId: typeof b.dicePresetId === 'string' ? b.dicePresetId.substring(0, 48) : undefined,
      casas: normalizedTiles,
      ...(normalizedDeck ? { cardDeck: normalizedDeck } : {}),
      ...(recommendedPieces && recommendedPieces.length > 0 ? { recommendedPieces } : {}),
      autor: typeof b.autor === 'string' ? b.autor.replace(/[<>"'`]/g, '').trim().substring(0, 24) : undefined,
      criadoEm: Number(b.criadoEm) || now,
      atualizadoEm: now
    }
  };
}

// IndexedDB local persistence for Custom Boards
const BOARDS_DB_NAME = 'LegadoImortaisBoardsDB';
const BOARDS_DB_VERSION = 1;
const BOARDS_STORE = 'tabuleiros';

function openBoardsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível.'));
      return;
    }
    const req = indexedDB.open(BOARDS_DB_NAME, BOARDS_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOARDS_STORE)) {
        db.createObjectStore(BOARDS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir banco de tabuleiros.'));
  });
}

export const CustomBoardsStorage = {
  async listar(): Promise<CustomBoardConfig[]> {
    const db = await openBoardsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOARDS_STORE, 'readonly');
      const req = tx.objectStore(BOARDS_STORE).getAll();
      req.onsuccess = () => {
        const list = ((req.result || []) as CustomBoardConfig[]).sort(
          (a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0)
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },
  async salvar(board: CustomBoardConfig): Promise<void> {
    const valid = validateCustomBoardConfig(board);
    if (!valid.ok || !valid.normalized) {
      throw new Error(valid.erro || 'Tabuleiro inválido.');
    }
    const db = await openBoardsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOARDS_STORE, 'readwrite');
      tx.objectStore(BOARDS_STORE).put(valid.normalized);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  },
  async obterPorId(id: string): Promise<CustomBoardConfig | null> {
    const db = await openBoardsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOARDS_STORE, 'readonly');
      const req = tx.objectStore(BOARDS_STORE).get(id);
      req.onsuccess = () => resolve((req.result as CustomBoardConfig) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },
  async remover(id: string): Promise<void> {
    const db = await openBoardsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOARDS_STORE, 'readwrite');
      tx.objectStore(BOARDS_STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
};

// Interactive 3D Board Creator Preview (Three.js, RoomEnvironment, grounded props, software-WebGL safe)
export interface BoardPreviewController {
  setBoard: (board: CustomBoardConfig) => void;
  resetCamera: () => void;
  resize: () => void;
  dispose: () => void;
}

function buildCompositeProp(kind: BoardPropKind, accentColor: string): THREE.Group {
  const g = new THREE.Group();
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.28,
    metalness: 0.72
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
    metalness: 0.1
  });

  if (kind === 'cristais') {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 6), stoneMat);
    plinth.position.y = 0.04;
    const shardMain = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), accentMat);
    shardMain.scale.set(0.75, 1.85, 0.75);
    shardMain.position.y = 0.34;
    const shardSide = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), accentMat);
    shardSide.scale.set(0.7, 1.4, 0.7);
    shardSide.position.set(0.12, 0.2, 0.05);
    shardSide.rotation.z = -0.35;
    g.add(plinth, shardMain, shardSide);
  } else if (kind === 'arvores') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 0.28, 7),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, metalness: 0.02 })
    );
    trunk.position.y = 0.14;
    const crown1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.26, 7),
      new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.75, metalness: 0.04 })
    );
    crown1.position.y = 0.34;
    const crown2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.22, 7),
      new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7, metalness: 0.05 })
    );
    crown2.position.y = 0.48;
    g.add(trunk, crown1, crown2);
  } else if (kind === 'torres') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.36, 8), stoneMat);
    base.position.y = 0.18;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.24, 8), accentMat);
    roof.position.y = 0.48;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.12), accentMat);
    banner.position.set(0.17, 0.26, 0);
    g.add(base, roof, banner);
  } else if (kind === 'nebulosa') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.08, 12), stoneMat);
    base.position.y = 0.04;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), accentMat);
    planet.position.y = 0.32;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.02, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3, metalness: 0.8 })
    );
    ring.position.y = 0.32;
    ring.rotation.x = Math.PI * 0.36;
    g.add(base, planet, ring);
  } else {
    // pilares olímpicos
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.26), stoneMat);
    plinth.position.y = 0.03;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.42, 12), stoneMat);
    shaft.position.y = 0.27;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.24), accentMat);
    cap.position.y = 0.51;
    g.add(plinth, shaft, cap);
  }

  return g;
}

export function mountBoardCreatorPreview(
  container: HTMLElement,
  initialBoard: CustomBoardConfig
): BoardPreviewController {
  container.innerHTML = '';
  const width = Math.max(container.clientWidth || 320, 260);
  const height = Math.max(container.clientHeight || 260, 220);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const isSoftGl = detectSoftwareWebGL(renderer);

  renderer.setPixelRatio(isSoftGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !isSoftGl;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(initialBoard.corFundo || '#020617');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfffbeb, 2.2);
  key.position.set(4, 7, 5);
  if (!isSoftGl) key.castShadow = true;
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 40);
  camera.position.set(0, 5.4, 5.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.1, 0);
  controls.enableDamping = !isSoftGl;
  controls.autoRotate = !isSoftGl;
  controls.autoRotateSpeed = 0.85;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.minDistance = 4;
  controls.maxDistance = 12;
  controls.update();

  let boardGroup = new THREE.Group();
  scene.add(boardGroup);

  let disposed = false;
  let rafId = 0;

  const rebuild = (cfg: CustomBoardConfig) => {
    scene.remove(boardGroup);
    disposeSceneObject(boardGroup);
    boardGroup = new THREE.Group();
    scene.background = new THREE.Color(cfg.corFundo || '#020617');

    const slabMat = new THREE.MeshStandardMaterial({
      color: cfg.corSecundaria || '#1e293b',
      roughness: 0.62,
      metalness: 0.25
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.22, 5.6), slabMat);
    slab.position.y = -0.11;
    slab.receiveShadow = true;
    boardGroup.add(slab);

    const frameMat = new THREE.MeshStandardMaterial({
      color: cfg.corPrimaria || '#d97706',
      roughness: 0.28,
      metalness: 0.78
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.82, 0.14, 5.82), frameMat);
    frame.position.y = -0.15;
    boardGroup.add(frame);

    const totalTiles = Math.max(8, Math.min(24, cfg.casas?.length || cfg.tileCount || 12));
    const gridDims = computeFlexibleBoardGrid(totalTiles);
    const cols = gridDims.cols;
    const rows = gridDims.rows;
    const gap = cfg.espacamento === 'amplo' ? 0.14 : cfg.espacamento === 'compacto' ? 0.04 : 0.08;
    const span = 5.1;
    const cellW = (span - gap * (cols - 1)) / cols;
    const cellH = (span - gap * (rows - 1)) / rows;
    const cellSize = Math.min(cellW, cellH);

    let positions: Array<{ x: number; z: number }> = [];
    if (totalTiles === 2 * cols + 2 * (rows - 2)) {
      const gridCoords: Array<{ r: number; c: number }> = [];
      for (let c = 0; c < cols; c++) gridCoords.push({ r: 0, c });
      for (let r = 1; r < rows - 1; r++) gridCoords.push({ r, c: cols - 1 });
      for (let c = cols - 1; c >= 0; c--) gridCoords.push({ r: rows - 1, c });
      for (let r = rows - 2; r >= 1; r--) gridCoords.push({ r, c: 0 });
      positions = gridCoords.map((pos) => ({
        x: -span / 2 + cellW / 2 + pos.c * (cellW + gap),
        z: -span / 2 + cellH / 2 + pos.r * (cellH + gap)
      }));
    } else {
      const halfSpan = span * 0.5 - cellSize * 0.5;
      for (let idx = 0; idx < totalTiles; idx++) {
        const u = (idx / totalTiles) * 4;
        let nx = 0;
        let nz = 0;
        if (u < 1) { nx = -1 + 2 * u; nz = -1; }
        else if (u < 2) { nx = 1; nz = -1 + 2 * (u - 1); }
        else if (u < 3) { nx = 1 - 2 * (u - 2); nz = 1; }
        else { nx = -1; nz = 1 - 2 * (u - 3); }
        positions.push({ x: nx * halfSpan, z: nz * halfSpan });
      }
    }

    const maxAnisotropy = Math.min(4, renderer.capabilities?.getMaxAnisotropy?.() || 1);
    const drawTileTopTexture = (
      tile: CustomBoardTile,
      baseColor: string,
      highlightColor: string,
      imgEl?: HTMLImageElement | null
    ): THREE.CanvasTexture | null => {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = baseColor || '#1e293b';
      ctx.fillRect(0, 0, 160, 160);

      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        const minSide = Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
        const sx = (imgEl.naturalWidth - minSide) / 2;
        const sy = (imgEl.naturalHeight - minSide) / 2;
        ctx.drawImage(imgEl, sx, sy, minSide, minSide, 6, 6, 148, 148);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.52)';
        ctx.fillRect(6, 6, 148, 148);
      }

      ctx.strokeStyle = highlightColor || '#fbbf24';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 152, 152);

      // Dark high-contrast title bar
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(8, 92, 144, 58);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (tile.nome || '').slice(0, 15);
      ctx.fillText(label, 80, 114, 134);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 15px monospace';
      const subLabel =
        tile.tipo === 'propriedade'
          ? `$${tile.valor || 0}`
          : tile.tipo === 'inicio'
          ? 'INÍCIO'
          : tile.tipo === 'prisao'
          ? 'PRISÃO'
          : 'ORÁCULO';
      ctx.fillText(subLabel, 80, 138, 134);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      tex.needsUpdate = true;
      return tex;
    };

    positions.forEach((pos, idx) => {
      const tile = cfg.casas[idx];
      if (!tile) return;
      const tileHex =
        tile.tipo === 'inicio'
          ? cfg.corDestaque
          : tile.tipo === 'prisao'
          ? '#b91c1c'
          : tile.tipo === 'bencao'
          ? '#0891b2'
          : cfg.corPrimaria;
      const sideMat = new THREE.MeshStandardMaterial({
        color: tileHex,
        roughness: 0.45,
        metalness: 0.32
      });
      const topTex = drawTileTopTexture(tile, tileHex, cfg.corDestaque || '#fbbf24', null);
      const topMat = new THREE.MeshStandardMaterial({
        color: topTex ? 0xffffff : tileHex,
        map: topTex || null,
        roughness: 0.48,
        metalness: 0.16
      });
      const tMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cellSize, 0.12, cellSize),
        [sideMat, sideMat.clone(), topMat, sideMat.clone(), sideMat.clone(), sideMat.clone()]
      );
      tMesh.position.set(pos.x, 0.06, pos.z);
      tMesh.castShadow = true;
      tMesh.receiveShadow = true;
      boardGroup.add(tMesh);

      if (tile.imagemDataUrl && typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          if (disposed || tMesh.parent !== boardGroup) return;
          const imgTex = drawTileTopTexture(tile, tileHex, cfg.corDestaque || '#fbbf24', img);
          if (imgTex) {
            if (topMat.map) topMat.map.dispose();
            topMat.map = imgTex;
            topMat.needsUpdate = true;
            renderer.render(scene, camera);
          }
        };
        img.src = tile.imagemDataUrl;
      }
    });

    // Center Sanctuary Emblem + 4 corner decorative 3D props grounded at y=0
    const centerEmblem = buildCompositeProp(cfg.decoracao3d, cfg.corDestaque || '#fbbf24');
    centerEmblem.scale.setScalar(1.25);
    centerEmblem.position.set(0, 0, 0);
    boardGroup.add(centerEmblem);

    const propOffsets: Array<[number, number]> = [
      [-1.1, -1.1],
      [1.1, -1.1],
      [-1.1, 1.1],
      [1.1, 1.1]
    ];
    for (const [px, pz] of propOffsets) {
      const prop = buildCompositeProp(cfg.decoracao3d, cfg.corPrimaria);
      prop.scale.setScalar(0.68);
      prop.position.set(px, 0, pz);
      boardGroup.add(prop);
    }

    scene.add(boardGroup);
    renderer.render(scene, camera);
  };

  rebuild(initialBoard);

  let lastDraw = 0;
  const tick = (now: number) => {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    if (isSoftGl && now - lastDraw < 90) return;
    lastDraw = now;
    controls.update();
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    setBoard(board: CustomBoardConfig) {
      if (disposed) return;
      rebuild(board);
    },
    resetCamera() {
      camera.position.set(0, 5.4, 5.4);
      controls.target.set(0, 0.1, 0);
      controls.update();
    },
    resize() {
      if (disposed) return;
      const nw = Math.max(container.clientWidth || 320, 240);
      const nh = Math.max(container.clientHeight || 260, 200);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      controls.dispose();
      disposeSceneObject(boardGroup);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
