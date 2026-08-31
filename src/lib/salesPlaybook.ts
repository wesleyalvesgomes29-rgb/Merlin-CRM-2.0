/**
 * MERLIN CRM - LIVRETO DE SCRIPTS COMERCIAIS & METODOLOGIA DE ATENDIMENTO
 * Baseado na metodologia de alta conversão para mercado imobiliário e MCMV/Caixa.
 * 
 * DIRETRIZES FUNDAMENTAIS:
 * 1. REGRA DE OURO: Não despejar informação ("infodump"). O script serve para conduzir a conversa.
 *    Faça uma pergunta por vez, entenda a resposta e só então avance.
 * 2. SEMPRE PROCURE O PRÓXIMO PASSO: Toda mensagem deve levar a uma ação concreta (entender renda,
 *    identificar perfil moradia/investimento, apresentar opção, encaminhar pré-análise ou coletar docs).
 * 3. TÉCNICA DE FECHAMENTO (DUPLA ALTERNATIVA / EITHER-OR): Toda mensagem para o cliente deve terminar
 *    obrigatoriamente com uma pergunta estruturada em dupla alternativa para facilitar a resposta imediata.
 */

export type PlaybookPillarId =
  | 'primeiro-contato'
  | 'retrabalho'
  | 'objecao-mcmv-caixa'
  | 'renda-baixa-investidor'
  | 'reversao-casa-terreo'
  | 'pre-analise-docs'
  | 'objecao-personalizada';

export interface PlaybookPillar {
  id: PlaybookPillarId;
  title: string;
  shortTitle: string;
  subtitle: string;
  iconName: string;
  badge: string;
  description: string;
  goldenRule: string;
  closingQuestionExample: string;
  standardScripts: {
    title: string;
    description: string;
    template: string;
  }[];
}

export const SALES_PLAYBOOK_PILLARS: PlaybookPillar[] = [
  {
    id: 'primeiro-contato',
    title: '1. Primeiro Contato (Lead Novo)',
    shortTitle: 'Primeiro Contato',
    subtitle: 'Qualificação inicial sem despejo de informações',
    iconName: 'UserCheck',
    badge: 'Lead Novo',
    description: 'Apresentação amigável e sondagem imediata de perfil sem enviar PDFs pesados ou textos longos.',
    goldenRule: 'Descubra rapidamente se o lead busca moradia ou investimento antes de apresentar qualquer empreendimento.',
    closingQuestionExample: 'Hoje você busca o imóvel mais para morar ou investir?',
    standardScripts: [
      {
        title: 'Abordagem Inicial Padrão',
        description: 'Primeira mensagem enviada para leads recém-chegados.',
        template: `Prazer {NOME}! Meu nome é {CORRETOR}, sou consultor aqui da INC Empreendimentos. Vi seu interesse em um dos nossos empreendimentos e estou entrando em contato para entender melhor o que você busca hoje e te passar as condições que podem fazer mais sentido pra você.\n\nHoje você busca o imóvel mais para morar ou investir?`
      },
      {
        title: 'Abordagem Direta com Menção ao Imóvel',
        description: 'Quando o lead já veio de anúncio específico.',
        template: `Olá, {NOME}! Tudo joia? Aqui é o {CORRETOR}, da INC Empreendimentos. Vi que você solicitou informações sobre {EMPREENDIMENTO}.\n\nEstou separando os detalhes mais importantes para você. Só para eu te orientar certinho: você está buscando esse imóvel pensando em moradia própria ou para investimento?`
      }
    ]
  },
  {
    id: 'retrabalho',
    title: '2. Retrabalho / Resgate de Lead Parado',
    shortTitle: 'Retrabalho & Resgate',
    subtitle: 'Reativação com proposta irresistível e micro-compromisso',
    iconName: 'RefreshCw',
    badge: 'Reativação',
    description: 'Abordagem direta com âncora de valor real (parcelas a partir de R$ 700 / entrada em até 60x) pedindo apenas um "Sim".',
    goldenRule: 'Proponha uma condição concreta e peça uma resposta simples de 1 palavra para gerar micro-compromisso.',
    closingQuestionExample: 'Me responde um "Sim" aqui, só para eu saber se faz sentido eu te apresentar o projeto agora?',
    standardScripts: [
      {
        title: 'Disparo de Retrabalho com Âncora Financeira',
        description: 'Script para acordar leads parados há semanas ou meses.',
        template: `Bom dia {NOME}, tudo joia? Aqui é o {CORRETOR}. Vi que você interagiu com um dos nossos anúncios sobre imóveis um tempo atrás.\n\nDeixa eu te fazer uma pergunta bem direta: Se hoje eu te apresentasse um imóvel em {BAIRRO} onde você consegue parcelar a entrada em até 60x, com mensais a partir de R$ 700,00, faria sentido para você conhecer? Pegando uma das últimas unidades com essa condição de tabela.\n\nMe responde um "Sim" aqui, só para eu saber se faz sentido eu te apresentar o projeto agora?`
      },
      {
        title: 'Continuação Imediata (Após o Cliente responder "Sim")',
        description: 'Conduzir imediatamente para a qualificação de renda.',
        template: `Perfeito, {NOME}! Então deixa eu te apresentar melhor o projeto e te explicar como funciona essa condição de entrada e parcelas.\n\nAntes, só para eu entender se consigo te encaixar exatamente nessa condição de tabela: hoje sua renda familiar fica em média em quanto?`
      },
      {
        title: 'Lead respondeu que "Já comprou/Já resolveu"',
        description: 'Manter a porta aberta e entender o perfil real.',
        template: `Perfeito, {NOME}! Fico feliz que tenha conseguido resolver! 🎉\n\nSó para eu deixar registrado aqui e não te enviar mensagens desnecessárias: você acabou adquirindo para morar ou foi mais pensando em investimento?`
      }
    ]
  },
  {
    id: 'objecao-mcmv-caixa',
    title: '3. Objeções, MCMV & Financiamento Caixa',
    shortTitle: 'MCMV & Financiamento',
    subtitle: 'Explicar regras, subsídio e parcelas de forma simples',
    iconName: 'Building2',
    badge: 'Crédito Imobiliário',
    description: 'Desmistificar o financiamento bancário sem termos difíceis e conduzir com segurança para a simulação.',
    goldenRule: 'Nunca discuta taxas complexas por texto: explique que a Caixa define os limites e peça a renda para simular.',
    closingQuestionExample: 'Hoje sua renda fica em média em quanto, somando você e quem for compor?',
    standardScripts: [
      {
        title: 'Cliente tem medo ou não entende como funciona a Caixa',
        description: 'Acalmar o cliente e pedir a renda.',
        template: `Fica tranquilo {NOME}, é bem mais simples do que parece! 😊\n\nBasicamente a Caixa faz uma análise prévia para entender o valor que ela libera para você em financiamento, taxa de juros reduzida e o valor da parcela. Com isso em mãos, nós montamos um fluxo sob medida para a sua realidade.\n\nHoje sua renda mensal fica em média em quanto?`
      },
      {
        title: 'Explicação Didática do Minha Casa Minha Vida',
        description: 'Explicar benefícios, subsídio e uso do FGTS.',
        template: `Hoje o Minha Casa Minha Vida é o programa da Caixa criado para facilitar a conquista do imóvel próprio. Dependendo da sua renda, a Caixa oferece taxa de juros reduzida e, em muitos casos, subsídio do governo que abate direto no valor do imóvel. Além disso, você pode usar o saldo do FGTS na entrada.\n\nPara eu ver se você tem direito ao subsídio máximo: você pretende comprar sozinho ou compondo renda com alguém da família?`
      },
      {
        title: 'Dúvida sobre Entrada e Parcelas',
        description: 'Conduzir para a montagem de um fluxo personalizado.',
        template: `Entendo perfeitamente, {NOME}. Pelo Minha Casa Minha Vida nós conseguimos diluir a entrada e encaixar as parcelas dentro do que cabe no seu bolso.\n\nCom algumas informações básicas, já calculamos exatamente o seu poder de compra. Hoje sua renda fica mais próxima de R$ 2.500 ou acima de R$ 4.000?`
      }
    ]
  },
  {
    id: 'renda-baixa-investidor',
    title: '4. Qualificação: Renda Baixa ou Perfil Investidor',
    shortTitle: 'Renda & Investidor',
    subtitle: 'Composição de renda, tempo de carteira e investidores',
    iconName: 'PieChart',
    badge: 'Perfil Financeiro',
    description: 'Estratégias para viabilizar crédito com composição familiar ou direcionar investidores para rentabilidade.',
    goldenRule: 'Se a renda for baixa, abra imediatamente a porta da composição familiar e tempo de carteira assinada.',
    closingQuestionExample: 'Você prefere receber a projeção de valorização ou o fluxo de locação estimada?',
    standardScripts: [
      {
        title: 'Renda Individual Baixa - Investigar Composição',
        description: 'Descobrir se pode somar renda com cônjuge, pais ou irmãos.',
        template: `Entendi perfeitamente, {NOME}. Essa renda informada seria só sua ou existiria a possibilidade de compor com cônjuge, noivo(a) ou alguém da família?\n\nOutro ponto que nos ajuda muito na aprovação com juros menores é o tempo de carteira assinada (mais de 3 anos sob regime CLT). Você tem registro em carteira atualmente ou trabalha como autônomo?`
      },
      {
        title: 'Lead Investidor - Sondagem de Foco',
        description: 'Descobrir se o investidor quer renda de aluguel ou ganho de capital na planta.',
        template: `Excelente, {NOME}! Temos opções de lançamentos com excelente potencial de liquidez.\n\nO que mais te chama a atenção hoje pensando no seu portfólio: rentabilidade mensal com locação ou ganho de capital na valorização até a entrega das chaves?`
      },
      {
        title: 'Empreendimento Anterior Esgotado / Lançamento Substituto',
        description: 'Transição suave quando o imóvel procurado já acabou.',
        template: `O {EMPREENDIMENTO_ANTERIOR} realmente teve uma saída recorde e esgotou super rápido! Mas a excelente notícia é que acabamos de abrir o lançamento de {EMPREENDIMENTO}, com a mesma proposta moderna e condições especiais de tabela zero.\n\nO que mais tinha te chamado a atenção no projeto anterior: a localização ou o valor da parcela?`
      }
    ]
  },
  {
    id: 'reversao-casa-terreo',
    title: '5. Reversão: Quer Casa ➔ Térreo com Quintal',
    shortTitle: 'Reversão: Casa p/ Quintal',
    subtitle: 'Conectar o desejo de espaço ao térreo com garden privativo',
    iconName: 'Home',
    badge: 'Reversão de Perfil',
    description: 'Entender a real dor de quem quer casa (quintal, pet, privacidade) e apresentar o térreo com quintal privativo.',
    goldenRule: 'Não tente forçar um apartamento comum: venda o quintal privativo somado ao lazer e segurança de condomínio fechado.',
    closingQuestionExample: 'Você prefere que eu te envie a planta baixa desse térreo com quintal ou um vídeo da área externa?',
    standardScripts: [
      {
        title: 'Passo 1: Descobrir o real motivo do desejo por casa',
        description: 'Sondar se a busca é por quintal, espaço para pet, churrasqueira ou privacidade.',
        template: `Entendi, {NOME}! E me fala uma coisa... o que mais pesa para você hoje na decisão de buscar uma casa? Ter quintal para pet/crianças, mais privacidade ou espaço externo para churrasco?`
      },
      {
        title: 'Passo 2: Apresentar o Térreo com Quintal (O Melhor dos Dois Mundos)',
        description: 'Conectar a dor do cliente à unidade Garden com condomínio seguro.',
        template: `Entendi você perfeitamente! E justamente por isso achei que faria todo sentido te mostrar uma opção que une o melhor dos dois mundos: temos unidades térreas com quintal privativo em {BAIRRO}.\n\nVocê tem a sensação de espaço, liberdade e quintal de uma casa, mas com toda a segurança 24h e lazer completo de condomínio fechado.\n\nVocê prefere que eu te envie a foto da planta desse térreo ou o vídeo do espaço com quintal?`
      },
      {
        title: 'Passo 3: Superar a resistência a apartamento',
        description: 'Explicar a escassez e o custo-benefício frente a casas MCMV distantes.',
        template: `Te entendo perfeitamente, {NOME}. Muita gente chega aqui com esse mesmo pensamento. Hoje, casas individuais no Minha Casa Minha Vida ficaram muito distantes ou com entradas altíssimas.\n\nPor isso as unidades térreas com quintal viraram a melhor alternativa para ter área privativa sem estourar o orçamento.\n\nFaz sentido eu te apresentar uma simulação para essa unidade térrea ou você prefere ver uma opção tradicional de 2 quartos?`
      }
    ]
  },
  {
    id: 'pre-analise-docs',
    title: '6. Encaminhamento de Pré-Análise & Documentação',
    shortTitle: 'Pré-Análise & Documentos',
    subtitle: 'Coleta de documentos sem atrito e com clareza total',
    iconName: 'FileCheck',
    badge: 'Fechamento',
    description: 'Condução natural para o envio dos documentos ou agendamento presencial para montar a pasta da Caixa.',
    goldenRule: 'Apresente a pré-análise como um benefício para descobrir o limite de crédito liberado, e forneça a lista de docs organizada em tópicos.',
    closingQuestionExample: 'Você prefere me enviar as fotos dos documentos por aqui no WhatsApp ou prefere vir até o plantão?',
    standardScripts: [
      {
        title: 'Encaminhamento Seguro para a Pré-Análise',
        description: 'Apresentar a pré-análise como o próximo passo inteligente.',
        template: `Perfeito, {NOME}! Com esses dados nós já conseguimos fazer uma análise bem vantajosa para vocês junto à Caixa.\n\nO passo mais inteligente agora é rodar a pré-análise de crédito, porque com ela descobrimos exatamente o valor financiado, subsídio do governo e taxa de juros real, sem compromisso nenhum.\n\nVocê prefere me enviar a documentação por aqui no WhatsApp ou prefere vir até a nossa sede/plantão para tomarmos um café e fazermos juntos?`
      },
      {
        title: 'Checklist Limpo de Documentação',
        description: 'Lista formatada em tópicos claros e fáceis de ler.',
        template: `Perfeito, {NOME}! Aqui está a listinha dos documentos básicos para a gente dar entrada na sua pré-análise:\n\n📄 *Documentos necessários:*\n• CPF e RG (ou CNH)\n• Certidão de nascimento ou casamento\n• Comprovante de endereço atualizado\n• Holerites recentes (os 3 últimos)\n• Carteira de Trabalho (pode ser print da CTPS Digital)\n• Extrato do FGTS (se tiver saldo)\n\nPode tirar foto nítida e me mandar por aqui mesmo no WhatsApp! Você consegue me enviar ainda hoje ou prefere separar tudo com calma amanhã?`
      },
      {
        title: 'Acolhimento e Suporte no Envio',
        description: 'Tranquilizar o cliente sobre dúvidas nos documentos.',
        template: `Combinado, {NOME}! Assim que você me mandar as fotos dos documentos eu já dou prioridade máxima na sua pasta para conseguirmos a melhor condição liberada pela Caixa.\n\nSe tiver qualquer dúvida na hora de achar algum documento, pode me chamar aqui que eu te ajudo no passo a passo, tá bom?`
      }
    ]
  },
  {
    id: 'objecao-personalizada',
    title: '7. Tratamento de Objeções Específicas',
    shortTitle: 'Objeções Gerais',
    subtitle: 'Superação de objeções clássicas de momento e preço',
    iconName: 'ShieldAlert',
    badge: 'Objeções',
    description: 'Tratar "vou ver com minha esposa", "está caro", "vou deixar para o ano que vem" ou "preciso pensar".',
    goldenRule: 'Valide o sentimento do cliente primeiro, desmonte a barreira com uma pergunta reflexiva e finalize com dupla alternativa.',
    closingQuestionExample: 'Você prefere que eu guarde essa condição até amanhã às 12h ou às 18h?',
    standardScripts: [
      {
        title: 'Objeção: "Preciso falar com meu cônjuge / família"',
        description: 'Envolver o parceiro na decisão sem pressionar.',
        template: `Com certeza, {NOME}! Essa é uma decisão familiar muito importante e é fundamental que vocês conversem.\n\nPara ajudar vocês nessa conversa, eu posso preparar um resumo claro das parcelas e fotos do projeto.\n\nVocê prefere que eu te envie o resumo em PDF ou faz mais sentido agendarmos uma chamada rápida de 5 minutos com vocês dois juntos?`
      },
      {
        title: 'Objeção: "Vou deixar mais para frente / Não é o momento"',
        description: 'Mostrar o risco de perda de tabela zero e aumento de taxas.',
        template: `Te compreendo perfeitamente, {NOME}. O único detalhe é que as condições de tabela de lançamento e subsídios da Caixa sofrem reajustes frequentes.\n\nDeixar a sua pré-análise aprovada hoje não te obriga a comprar, mas garante que você trave as melhores condições do mercado.\n\nVale mais a pena deixarmos sua análise pré-aprovada agora ou você prefere apenas que eu te mande novidades no próximo mês?`
      }
    ]
  }
];

export interface PlaybookPromptVariables {
  clientName: string;
  brokerName?: string;
  companyName?: string;
  clientInterest?: string;
  clientNotes?: string;
  clientStatus?: string;
  intentId: PlaybookPillarId;
  goal?: string;
  customInstructions?: string;
  secondBrainContext?: string;
}

/**
 * Gera as instruções completas do Livreto de Scripts Comerciais para injetar no System Prompt do Gemini.
 * O nome da empresa/imobiliária e o nome do corretor são 100% dinâmicos e adaptáveis.
 */
export function buildPlaybookSystemPrompt(companyName: string = "consultoria imobiliária especializada"): string {
  const cleanCompany = companyName.trim() || "consultoria imobiliária especializada";

  return `=== METODOLOGIA COMERCIAL OBRIGATÓRIA: LIVRETO DE SCRIPTS COMERCIAIS (${cleanCompany.toUpperCase()}) ===
Você é o motor de inteligência e copywriting comercial do Merlin CRM, treinado rigorosamente na metodologia de atendimento e vendas de alta conversão imobiliária e Minha Casa Minha Vida (Caixa Econômica Federal).

🚫 REGRAS ANTI-BUROCRACIA & VETOS CRÍTICOS (LEIA COM MÁXIMA ATENÇÃO):
1. PROIBIÇÃO ABSOLUTA DE JARGÕES DE SISTEMA:
   - NUNCA invente ou use falas como "vi que seu cadastro está com pendências", "faltam dados no seu cadastro", "seu perfil está incompleto", "precisamos atualizar suas informações no sistema" ou qualquer menção a banco de dados/CRM.
   - Campos vazios ou não preenchidos no CRM significam APENAS que o lead acabou de chegar (Lead Novo), e NUNCA que ele tem pendências, dívidas ou problemas.
   - O corretor SEMPRE se comunica como um consultor humano, caloroso, acolhedor e focado em ajudar o cliente.

2. NOMES DINÂMICOS OBRIGATÓRIOS (NUNCA FIXE NOMES PADRÃO):
   - Utilize SEMPRE o nome do corretor/consultor informado no contexto (${cleanCompany}) e NUNCA assuma nomes fictícios (ex: "Wesley" ou "INC Empreendimentos" NÃO devem ser usados a menos que tenham sido expressamente informados no prompt).
   - Se o nome da empresa for informado, mencione "${cleanCompany}". Caso contrário, apresente-se como consultor imobiliário especializado.

3. REGRA DE OURO (SEM INFODUMP):
   - NUNCA despeje informações demais, tabelas pesadas ou descrições prolixas de empreendimentos.
   - O objetivo da mensagem NÃO é vender o imóvel por texto, mas sim CONDUZIR A CONVERSA para o próximo passo concreto.
   - Faça apenas UMA pergunta chave por mensagem. Textos curtos, prontos para WhatsApp, com quebras de linha e emojis elegantes (1 a 3 no máximo).

4. TÉCNICA OBRIGATÓRIA DE FECHAMENTO (DUPLA ALTERNATIVA / EITHER-OR):
   - TODA e qualquer mensagem gerada para o cliente DEVE TERMINAR OBRIGATORIAMENTE com uma pergunta em DUPLA ALTERNATIVA (escolha binária simples).

🎯 ESTRUTURA DOS PILARES METODOLÓGICOS DO LIVRETO:

• PILAR 1: PRIMEIRO CONTATO (LEAD NOVO)
  - Estrutura Mandatória:
    "Prazer [NOME_DO_CLIENTE]! Meu nome é [NOME_DO_CONSULTOR], sou consultor aqui da [NOME_DA_EMPRESA]. Vi seu interesse em um dos nossos empreendimentos [ou {EMPREENDIMENTO}] e estou entrando em contato para entender melhor o que você busca hoje e te passar as condições que podem fazer mais sentido pra você.\n\nHoje você busca o imóvel mais para morar ou investir?"
  - Pergunta de Fechamento: "Hoje você busca o imóvel mais para morar ou investir?"

• PILAR 2: RETRABALHO / RESGATE DE LEAD PARADO
  - Estrutura Mandatória:
    Apresentação educada + Oferta com âncora financeira concreta (ex: parcelamento de entrada em até 60x, mensais a partir de R$ 700 / condição de tabela) + Pedido de micro-compromisso simples.
  - Pergunta de Fechamento: "Me responde um 'Sim' aqui, só para eu saber se faz sentido eu te apresentar o projeto agora?" OU "Você ainda está avaliando opções de imóveis ou já conseguiu encontrar o que buscava?"

• PILAR 3: OBJEÇÕES, MCMV & FINANCIAMENTO CAIXA
  - Estrutura Mandatória:
    Acalmar o cliente ("Fica tranquilo [NOME], é bem mais simples do que parece! 😊") + Explicar de forma didática e simples como a Caixa viabiliza o financiamento (juros reduzidos, subsídio do governo que abate no valor e uso do FGTS) + Conduzir para a qualificação de renda.
  - Pergunta de Fechamento: "Hoje sua renda mensal fica mais próxima de R$ 2.500 ou acima de R$ 4.000?" OU "Você pretende comprar sozinho ou compondo renda com alguém da família?"

• PILAR 4: QUALIFICAÇÃO DE RENDA BAIXA OU PERFIL INVESTIDOR
  - Se Renda Baixa / Composição: Investigar se há cônjuge/familiar para somar renda e se tem mais de 3 anos de carteira CLT.
  - Se Investidor: Sondar o objetivo estratégico.
  - Pergunta de Fechamento: "Essa renda seria só sua ou teria a possibilidade de compor com alguém da família?" OU "O que mais te atrai hoje: rentabilidade com locação ou ganho de capital na valorização até as chaves?"

• PILAR 5: REVERSÃO (QUER CASA ➔ TÉRREO COM QUINTAL / GARDEN)
  - Estrutura Mandatória:
    Validar o desejo genuíno por espaço/quintal/pet + Apresentar a unidade térrea com quintal privativo (Garden) como a solução inteligente que une o espaço e quintal de uma casa com a segurança 24h e lazer de condomínio fechado.
  - Pergunta de Fechamento: "Você prefere que eu te envie as fotos da planta térrea com quintal ou o vídeo do decorado?"

• PILAR 6: ENCAMINHAMENTO DE PRÉ-ANÁLISE & DOCUMENTAÇÃO
  - Estrutura Mandatória:
    Apresentar a pré-análise de crédito gratuita na Caixa como um benefício inteligente (para travar taxas menores e subsídio sem compromisso) antes de pedir os documentos + Checklist limpo e organizado em tópicos (RG, Comprovante, Certidão, 3 Holerites, Carteira de Trabalho, Extrato FGTS).
  - Pergunta de Fechamento: "Você prefere me enviar as fotos dos documentos por aqui no WhatsApp ou prefere agendar um café no nosso plantão para fazermos juntos?"

FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):
Você DEVE SEMPRE responder em JSON estrito com exatamente duas abordagens personalizadas para o corretor escolher:
{
  "options": [
    {
      "label": "Opção Direta / Objetiva",
      "style": "direta",
      "text": "Texto pronto da mensagem para WhatsApp..."
    },
    {
      "label": "Opção Consultiva / Acolhedora",
      "style": "consultiva",
      "text": "Texto pronto da mensagem para WhatsApp..."
    }
  ],
  "goldenTip": "Dica prática de condução para o corretor."
}
`;
}

/**
 * Fallback de emergência offline / IA indisponível com as 2 opções completas do Playbook
 */
export function getPlaybookFallbackOptions(
  intent: PlaybookPillarId,
  clientData: {
    name: string;
    empreendimento?: string;
    notes?: string;
    brokerName?: string;
    companyName?: string;
  }
): { options: { label: string; style: string; text: string }[]; goldenTip: string } {
  const name = clientData.name || 'Cliente';
  const broker = clientData.brokerName?.trim() || 'seu consultor';
  const company = clientData.companyName?.trim() || '';
  const emp = clientData.empreendimento || 'o imóvel de seu interesse';
  const companyIntro = company ? ` aqui da ${company}` : '';

  switch (intent) {
    case 'retrabalho':
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Bom dia ${name}, tudo joia? Aqui é o ${broker}${company ? `, da ${company}` : ''}. Vi que você interagiu com nosso anúncio sobre imóveis um tempo atrás.\n\nDeixa eu te fazer uma pergunta bem direta: Se hoje eu te apresentasse uma condição em ${emp} onde você consegue parcelar a entrada em até 60x, com mensais a partir de R$ 700,00, faria sentido para você conhecer? Pegando uma das últimas unidades com essa condição.\n\nMe responde um "Sim" aqui, só para eu saber se faz sentido eu te apresentar o projeto agora?`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Olá, ${name}! Tudo bem com você? Aqui é o ${broker}${company ? `, da ${company}` : ''}.\n\nEstive revisando algumas oportunidades exclusivas e lembrei do seu perfil. Conseguimos uma negociação diferenciada para ${emp}, com entrada super facilitada e fluxo sob medida.\n\nVocê ainda está avaliando opções no mercado ou já conseguiu encontrar o imóvel ideal?`
          }
        ],
        goldenTip: 'Se o cliente responder "Sim", não despeje a tabela: pergunte imediatamente qual a média de renda familiar para checar o enquadramento.'
      };

    case 'reversao-casa-terreo':
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Oi ${name}, tudo bem? Aqui é o ${broker}${company ? ` da ${company}` : ''}. Entendi que você tem preferência por casa! Me fala uma coisa: o que mais pesa para você hoje na ideia de casa? Mais espaço de quintal para pet/família ou mais privacidade no dia a dia?`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Olá, ${name}! Aqui é o ${broker}${company ? ` da ${company}` : ''}. Entendo perfeitamente o seu desejo por uma casa. Justamente por isso lembrei de você: temos unidades térreas com quintal privativo em ${emp}, que entregam a mesma sensação de espaço de uma casa com a segurança de um condomínio fechado.\n\nVocê prefere que eu te envie as fotos da planta térrea ou o vídeo do espaço com quintal?`
          }
        ],
        goldenTip: 'Apresente o apartamento térreo com quintal como a solução inteligente que une espaço privativo com segurança e lazer.'
      };

    case 'objecao-mcmv-caixa':
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Fica tranquilo ${name}, é bem mais simples do que parece! A Caixa faz uma análise prévia e libera as melhores condições de juros e subsídio pelo Minha Casa Minha Vida.\n\nHoje sua renda mensal fica mais próxima de R$ 2.500 ou acima de R$ 4.000?`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Olá, ${name}! Aqui é o ${broker}${company ? ` da ${company}` : ''}. O Minha Casa Minha Vida foi feito justamente para viabilizar o imóvel próprio com entrada parcelada e juros baixos. Conseguimos montar um fluxo personalizado para o seu bolso.\n\nPara eu fazer uma prévia exata: você pretende comprar sozinho ou somando renda com alguém da família?`
          }
        ],
        goldenTip: 'Desmistifique o processo da Caixa e ancore na renda para calcular o subsídio e valor liberado.'
      };

    case 'pre-analise-docs':
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Perfeito, ${name}! O próximo passo mais seguro é rodar sua pré-análise na Caixa para vermos o valor aprovado e subsídio sem compromisso.\n\n📄 *Documentos necessários (fotos pelo WhatsApp):*\n• RG/CNH e CPF\n• Comprovante de endereço\n• Certidão de nascimento ou casamento\n• 3 últimos holerites\n• Carteira de Trabalho (CTPS Digital)\n• Extrato FGTS (se tiver)\n\nVocê prefere me enviar as fotos por aqui no WhatsApp ou vir até o plantão?`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Excelente, ${name}! Com seus dados já conseguimos um resultado excelente na Caixa. O passo ideal agora é montarmos a sua pré-análise de crédito gratuita para travar a taxa de juros mais baixa.\n\nVocê prefere me enviar os documentos pelo WhatsApp ou prefere agendar um café no nosso plantão para fazermos juntos?`
          }
        ],
        goldenTip: 'Mantenha a lista de documentos limpa e ofereça a escolha entre envio digital ou visita presencial.'
      };

    case 'renda-baixa-investidor':
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Entendi, ${name}! Essa renda informada seria só sua ou teria a possibilidade de compor com cônjuge, noivo(a) ou familiar? Composição e tempo de carteira assinada ajudam a reduzir muito a entrada!`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Olá, ${name}! Aqui é o ${broker}${company ? ` da ${company}` : ''}. Para investidores em ${emp}, temos opções com excelente rentabilidade de locação e ganho de valorização na planta.\n\nO que mais te atrai hoje: fluxo de aluguel mensal ou valorização na entrega das chaves?`
          }
        ],
        goldenTip: 'Investigue composição familiar ou direcione o investidor para sua meta financeira principal.'
      };

    case 'primeiro-contato':
    default:
      return {
        options: [
          {
            label: 'Opção Direta / Objetiva',
            style: 'direta',
            text: `Prazer ${name}! Meu nome é ${broker}, sou consultor${companyIntro}. Vi seu interesse em um dos nossos empreendimentos${emp !== 'o imóvel de seu interesse' ? ` (${emp})` : ''} e estou entrando em contato para entender melhor o que você busca hoje e te passar as condições que podem fazer mais sentido pra você.\n\nHoje você busca o imóvel mais para morar ou investir?`
          },
          {
            label: 'Opção Consultiva / Acolhedora',
            style: 'consultiva',
            text: `Olá, ${name}! Tudo bem com você? Aqui é o ${broker}${company ? `, da ${company}` : ''}.\n\nVi seu interesse no ${emp} e estou à disposição para te auxiliar com todas as informações e simulações personalizadas.\n\nHoje você busca esse imóvel pensando em moradia própria ou para investimento?`
          }
        ],
        goldenTip: 'Nunca envie catálogo completo ou tabela de cara: descubra primeiro se é moradia ou investimento.'
      };
  }
}
