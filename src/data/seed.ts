import { Client, Tag, Sale } from '../types';

export const DEFAULT_TAGS: Tag[] = [
  { id: '1', name: 'Lead Novo', color: 'bg-orange-500/10 dark:bg-[#FD7A00]/15 text-orange-600 dark:text-[#FD7A00] border-orange-500/30 dark:border-[#FD7A00]/40' },
  { id: '2', name: 'Primeiro Contato', color: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-[#FBBF24] border-amber-500/30 dark:border-amber-500/40' },
  { id: '3', name: 'Sem Resposta', color: 'bg-zinc-100 dark:bg-[#222222] text-zinc-600 dark:text-[#888888] border-zinc-200 dark:border-[#2A2A2A]' },
  { id: '4', name: 'Retornar Hoje', color: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-[#FB7185] border-rose-500/30 dark:border-rose-500/40' },
  { id: '5', name: 'Retornar Amanhã', color: 'bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-[#FF9800] border-orange-500/30 dark:border-orange-500/40' },
  { id: '6', name: 'Interessado', color: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-[#FBBF24] border-amber-500/30 dark:border-amber-500/40' },
  { id: '7', name: 'Muito Interessado', color: 'bg-orange-500/15 dark:bg-[#FD7A00]/20 text-orange-700 dark:text-[#FD7A00] border-orange-500/40 dark:border-[#FD7A00]/50 font-bold' },
  { id: '8', name: 'Agendado', color: 'bg-orange-500/10 dark:bg-[#FD7A00]/15 text-orange-600 dark:text-[#FD7A00] border-orange-500/30 dark:border-[#FD7A00]/40' },
  { id: '9', name: 'Visitou', color: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-[#34D399] border-emerald-500/30 dark:border-emerald-500/40' },
  { id: '10', name: 'Proposta', color: 'bg-orange-500/15 dark:bg-[#E85D00]/20 text-orange-700 dark:text-[#FF9800] border-orange-500/40 dark:border-[#E85D00]/50 font-medium' },
  { id: '11', name: 'Documentação', color: 'bg-orange-500/10 dark:bg-[#FD7A00]/15 text-orange-600 dark:text-[#FD7A00] border-orange-500/30 dark:border-[#FD7A00]/40' },
  { id: '12', name: 'Cliente Frio', color: 'bg-zinc-100 dark:bg-[#161616] text-zinc-600 dark:text-[#888888] border-zinc-200 dark:border-[#2A2A2A]' },
  { id: '13', name: 'Retrabalho', color: 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-[#FBBF24] border-amber-500/40 dark:border-amber-500/50 font-medium' },
  { id: '14', name: 'Venda Fechada', color: 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-[#10B981] border-emerald-500/40 dark:border-emerald-500/50 font-bold' },
  { id: '15', name: 'Perdido', color: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-[#FB7185] border-rose-500/30 dark:border-rose-500/40' },
  { id: '16', name: 'Descarte', color: 'bg-zinc-100 dark:bg-[#161616] text-zinc-500 dark:text-[#888888] border-zinc-200 dark:border-[#2A2A2A]' }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Ana Silva',
    phone: '(11) 98765-4321',
    createdAt: '2026-07-01T10:00:00.000Z',
    notes: 'Interessada em apartamento de 3 dormitórios no Jardins, São Paulo. Orçamento de até R$ 1.5M.',
    tags: ['Lead Novo'],
    status: 'Lead Novo',
    nextContactDate: null, // Sem retorno marcado (exibir alerta!)
    contactCount: 0,
    lastContactDate: null,
    history: [
      { id: 'h1', date: '2026-07-01T10:00:00.000Z', action: 'Lead cadastrado automaticamente via Portal Imobiliário' }
    ],
    comments: [
      { id: 'co1', date: '2026-07-01T10:05:00.000Z', text: 'Recebido lead do anúncio do Edifício Saint Honoré.' }
    ]
  },
  {
    id: 'c2',
    name: 'Carlos Santos',
    phone: '(11) 97654-3210',
    createdAt: '2026-07-05T14:30:00.000Z',
    notes: 'Procura casa em condomínio fechado em Alphaville. Exigência: quintal amplo com piscina e escritório.',
    tags: ['Primeiro Contato', 'Retornar Hoje'],
    status: 'Contato',
    nextContactDate: '2026-07-10T14:30:00', // Retornar Hoje!
    contactCount: 1,
    lastContactDate: '2026-07-05T15:00:00.000Z',
    history: [
      { id: 'h2', date: '2026-07-05T14:30:00.000Z', action: 'Cliente cadastrado manualmente' },
      { id: 'h3', date: '2026-07-05T15:00:00.000Z', action: 'Primeiro contato realizado via WhatsApp' }
    ],
    comments: [
      { id: 'co2', date: '2026-07-05T15:00:00.000Z', text: 'Conversamos sobre as opções. Ele gostou da Casa Residencial 4. Enviei o catálogo de fotos.' }
    ]
  },
  {
    id: 'c3',
    name: 'Mariana Costa',
    phone: '(21) 96543-2109',
    createdAt: '2026-06-20T09:00:00.000Z',
    notes: 'Quer comprar cobertura em Ipanema ou Leblon. Alto padrão.',
    tags: ['Sem Resposta', 'Retrabalho'],
    status: 'Retrabalho',
    nextContactDate: '2026-07-10T11:00:00', // Retornar Hoje, e sem contato há 15 dias!
    contactCount: 3,
    lastContactDate: '2026-06-25T11:00:00.000Z', // Mais de 7 dias sem contato -> sugerir retrabalho. Mais de 15 dias -> urgente.
    history: [
      { id: 'h4', date: '2026-06-20T09:00:00.000Z', action: 'Cadastro efetuado' },
      { id: 'h5', date: '2026-06-22T10:00:00.000Z', action: 'Contato telefônico realizado' },
      { id: 'h6', date: '2026-06-25T11:00:00.000Z', action: 'WhatsApp enviado (sem resposta)' }
    ],
    comments: [
      { id: 'co3', date: '2026-06-22T10:00:00.000Z', text: 'Atendeu mas estava em reunião. Pediu para retornar depois.' },
      { id: 'co4', date: '2026-06-25T11:00:00.000Z', text: 'Enviei fotos de coberturas disponíveis mas não visualizou.' }
    ]
  },
  {
    id: 'c4',
    name: 'Pedro Oliveira',
    phone: '(19) 95432-1098',
    createdAt: '2026-07-02T16:00:00.000Z',
    notes: 'Interessado em loteamento fechado em Campinas. Pretende construir a casa própria.',
    tags: ['Muito Interessado', 'Agendado'],
    status: 'Agendado',
    nextContactDate: '2026-07-09T15:00:00', // Lembrete Atrasado (Ontem)!
    contactCount: 2,
    lastContactDate: '2026-07-02T16:30:00.000Z',
    history: [
      { id: 'h7', date: '2026-07-02T16:00:00.000Z', action: 'Cadastro inicial efetuado' },
      { id: 'h8', date: '2026-07-02T16:30:00.000Z', action: 'Reunião virtual realizada' }
    ],
    comments: [
      { id: 'co5', date: '2026-07-02T16:30:00.000Z', text: 'Apresentei o loteamento Villa Flora. Super interessado, agendou visita para ontem mas precisou cancelar.' }
    ]
  },
  {
    id: 'c5',
    name: 'Beatriz Souza',
    phone: '(11) 94321-0987',
    createdAt: '2026-06-15T11:00:00.000Z',
    notes: 'Família buscando apartamento de 2 quartos próximo ao metrô na Vila Mariana.',
    tags: ['Visitou', 'Interessado'],
    status: 'Visitou',
    nextContactDate: '2026-07-11T10:00:00', // Retornar amanhã!
    contactCount: 4,
    lastContactDate: '2026-07-05T14:00:00.000Z',
    history: [
      { id: 'h9', date: '2026-06-15T11:00:00.000Z', action: 'Cadastrado via site corporativo' },
      { id: 'h10', date: '2026-06-18T14:00:00.000Z', action: 'Ligação telefônica e agendamento de visita' },
      { id: 'h11', date: '2026-06-22T10:00:00.000Z', action: 'Visita realizada no decorado' },
      { id: 'h12', date: '2026-07-05T14:00:00.000Z', action: 'Segunda visita ao imóvel real realizada' }
    ],
    comments: [
      { id: 'co6', date: '2026-06-22T10:00:00.000Z', text: 'Adorou o acabamento do decorado.' },
      { id: 'co7', date: '2026-07-05T14:00:00.000Z', text: 'A visita ao imóvel físico correu super bem. O marido gostou do sol da manhã. Ficou de conversar sobre o financiamento.' }
    ]
  },
  {
    id: 'c6',
    name: 'Ricardo Lima',
    phone: '(11) 93210-9876',
    createdAt: '2026-06-10T15:00:00.000Z',
    notes: 'Investidor focado em estúdios para locação por temporada em Pinheiros.',
    tags: ['Venda Fechada'],
    status: 'Venda Fechada',
    nextContactDate: null,
    contactCount: 6,
    lastContactDate: '2026-07-05T17:00:00.000Z',
    history: [
      { id: 'h13', date: '2026-06-10T15:00:00.000Z', action: 'Cadastro de investidor' },
      { id: 'h14', date: '2026-06-15T16:00:00.000Z', action: 'Envio de planilha de rentabilidade estimada' },
      { id: 'h15', date: '2026-06-20T10:00:00.000Z', action: 'Proposta de R$ 420.000 apresentada' },
      { id: 'h16', date: '2026-06-25T11:00:00.000Z', action: 'Proposta aceita pela construtora!' },
      { id: 'h17', date: '2026-07-05T17:00:00.000Z', action: 'Assinatura do contrato de compra e venda' }
    ],
    comments: [
      { id: 'co8', date: '2026-06-15T16:00:00.000Z', text: 'Mostrou muito interesse em estúdios próximos ao Metrô Fradique Coutinho.' },
      { id: 'co9', date: '2026-07-05T17:00:00.000Z', text: 'Venda assinada! Comissão cadastrada com sucesso. Enviar brinde de agradecimento.' }
    ]
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 's1',
    clientId: 'c6',
    clientName: 'Ricardo Lima',
    commissionValue: 12500,
    saleDate: '2026-07-05' // Venda deste mês (Julho 2026)
  },
  {
    id: 's2',
    clientName: 'Juliana Alves',
    commissionValue: 15200,
    saleDate: '2026-05-12' // Venda antiga deste ano
  },
  {
    id: 's3',
    clientName: 'Roberto Souza',
    commissionValue: 9800,
    saleDate: '2026-06-20' // Venda antiga deste ano
  }
];
