import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized GoogleGenAI instance
let aiInstance: GoogleGenAI | null = null;

function getGoogleGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A chave GEMINI_API_KEY não foi configurada nas configurações.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper: Try multiple models sequentially with a 20-second timeout each to ensure maximum resilience
async function generateWithFallbackAndTimeout(
  ai: GoogleGenAI,
  userPrompt: string,
  systemPrompt: string,
  temperature: number
): Promise<string> {
  const models = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Merlin Server] Tentando gerar conteúdo usando modelo: ${model}`);
      
      const responsePromise = ai.models.generateContent({
        model: model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: temperature,
        },
      });

      // 20-second timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout de 20 segundos atingido para o modelo ${model}.`)), 20000);
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (response && response.text) {
        console.log(`[Merlin Server] Conteúdo gerado com sucesso pelo modelo: ${model}`);
        return response.text;
      }
      throw new Error(`O modelo ${model} retornou uma resposta sem texto.`);
    } catch (error: any) {
      console.error(`[Merlin Server] Falha ao gerar com modelo ${model}:`, error.message || error);
      lastError = error;
    }
  }

  throw lastError || new Error("Falha ao gerar conteúdo com todos os modelos disponíveis.");
}

// Fallback generator for chat responses using local CRM intelligence when API key is unavailable/blocked
function generateFallbackChatResponse(
  message: string,
  clients: any[] = [],
  sales: any[] = [],
  engineResult?: any,
  brokerLearnedProfile?: any,
  refDate: Date = new Date()
): { text: string; action: any | null } {
  const lower = message.toLowerCase();
  const totalLeads = clients.length;
  const totalCommission = sales.reduce((sum: number, sale: any) => sum + (sale.commissionValue || 0), 0);
  const priorities = engineResult?.priorities || [];
  const overdueTasks = engineResult?.overdueTasks || [];
  const todayTasks = engineResult?.todayTasks || [];
  const alerts = engineResult?.alerts || [];

  // Helper date formatter YYYY-MM-DD
  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // CHECK: Task creation command vs mere statement
  const isCreationCommand = (
    lower.includes("quero fazer") ||
    lower.includes("quero agendar") ||
    lower.includes("crie uma tarefa") ||
    lower.includes("criar uma tarefa") ||
    lower.includes("crie a tarefa") ||
    lower.includes("cria uma tarefa") ||
    lower.includes("criar tarefa") ||
    lower.includes("crie tarefa") ||
    lower.includes("adicione na rotina") ||
    lower.includes("coloque na minha rotina") ||
    lower.includes("coloque na rotina") ||
    lower.includes("agende uma tarefa") ||
    lower.includes("agendar tarefa") ||
    lower.includes("agende para") ||
    lower.includes("agendar para") ||
    lower.includes("crie para") ||
    lower.includes("marca para") ||
    lower.includes("marque para") ||
    lower.includes("marcar para") ||
    lower.includes("lembre-me de")
  );

  const isMereStatement = (
    !isCreationCommand && (
      lower.includes("preciso fazer") ||
      lower.includes("tenho que fazer") ||
      lower.includes("preciso ligar") ||
      lower.includes("tenho que ligar") ||
      lower.includes("devo fazer")
    )
  );

  // If it is a mere statement without explicit command, ask safely
  if (isMereStatement) {
    return {
      text: `Entendi que você tem esse compromisso em mente, corretor! 🤔\n\nVocê gostaria que eu **crie essa tarefa na sua Minha Rotina**? Se sim, me confirme em qual data e horário você prefere (ex: *"Merlin, crie a tarefa para amanhã às 08:30"*).`,
      action: null
    };
  }

  // If it IS a clear task creation command
  if (isCreationCommand) {
    // 1. Calculate Date
    const targetDate = new Date(refDate);
    let dayLabel = "hoje";

    if (lower.includes("amanhã") || lower.includes("amanha")) {
      targetDate.setDate(targetDate.getDate() + 1);
      dayLabel = "amanhã";
    } else if (lower.includes("depois de amanhã") || lower.includes("depois de amanha")) {
      targetDate.setDate(targetDate.getDate() + 2);
      dayLabel = "depois de amanhã";
    } else if (lower.includes("segunda")) {
      const dist = (1 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "segunda-feira";
    } else if (lower.includes("terça") || lower.includes("terca")) {
      const dist = (2 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "terça-feira";
    } else if (lower.includes("quarta")) {
      const dist = (3 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "quarta-feira";
    } else if (lower.includes("quinta")) {
      const dist = (4 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "quinta-feira";
    } else if (lower.includes("sexta")) {
      const dist = (5 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "sexta-feira";
    } else if (lower.includes("sábado") || lower.includes("sabado")) {
      const dist = (6 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "sábado";
    } else if (lower.includes("domingo")) {
      const dist = (7 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "domingo";
    }

    const dueDate = formatDateStr(targetDate);

    // 2. Extract Time
    let dueTime: string | undefined = undefined;
    const timeMatch1 = message.match(/(\d{1,2}):(\d{2})/);
    const timeMatch2 = message.match(/(\d{1,2})\s*h(?:oras)?(?:\s*(\d{2}))?/i);

    if (timeMatch1) {
      dueTime = `${String(timeMatch1[1]).padStart(2, '0')}:${timeMatch1[2]}`;
    } else if (timeMatch2) {
      const h = String(timeMatch2[1]).padStart(2, '0');
      const m = timeMatch2[2] ? String(timeMatch2[2]).padStart(2, '0') : '00';
      dueTime = `${h}:${m}`;
    }

    // 3. Extract Client if mentioned
    let matchedClient: any = undefined;
    if (clients && clients.length > 0) {
      matchedClient = clients.find((c: any) => c.name && lower.includes(c.name.toLowerCase()));
    }

    // 4. Extract Action Type
    let actionType = 'Outro';
    if (lower.includes('retrabalho') || lower.includes('whatsapp') || lower.includes('whats') || lower.includes('mensagem')) {
      actionType = 'WhatsApp';
    } else if (lower.includes('ligar') || lower.includes('ligação') || lower.includes('ligacao') || lower.includes('telefone') || lower.includes('chamar')) {
      actionType = 'Ligação';
    } else if (lower.includes('visita') || lower.includes('visitar') || lower.includes('decorado') || lower.includes('imóvel') || lower.includes('imovel')) {
      actionType = 'Visita ao Imóvel';
    } else if (lower.includes('proposta') || lower.includes('enviar proposta')) {
      actionType = 'Enviar Proposta';
    } else if (lower.includes('reunião') || lower.includes('reuniao')) {
      actionType = 'Reunião';
    } else if (lower.includes('contrato') || lower.includes('documento') || lower.includes('docs')) {
      actionType = 'Contrato / Docs';
    }

    // 5. Extract Notes / Description
    let cleanNotes = message;
    // Remove prefixes like "merlin,", "crie uma tarefa para amanhã às 8:30", "quero fazer", etc.
    cleanNotes = cleanNotes
      .replace(/^merlin[,\s:]*/i, '')
      .replace(/(?:por favor|quero|crie|criar|agende|agendar|adicione|coloque|marca|marque)\s+(?:uma\s+tarefa|na\s+rotina|na\s+minha\s+rotina|para|a\s+tarefa)*/gi, '')
      .replace(/(?:amanhã|amanha|hoje|depois de amanhã|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo)/gi, '')
      .replace(/(?:às|as|ás|\sat\s)\s*\d{1,2}(?::\d{2}|h(?:\d{2})?)/gi, '')
      .replace(/^(?:para\s+|de\s+|que\s+|fazer\s+)*/i, '')
      .trim();

    if (!cleanNotes || cleanNotes.length < 3) {
      if (lower.includes('retrabalho')) {
        cleanNotes = 'Fazer retrabalhos';
      } else if (matchedClient) {
        cleanNotes = `${actionType} para ${matchedClient.name}`;
      } else {
        cleanNotes = 'Tarefa agendada pelo Merlin';
      }
    } else {
      // Capitalize first letter
      cleanNotes = cleanNotes.charAt(0).toUpperCase() + cleanNotes.slice(1);
    }

    // 6. Priority
    let priority: 'Alta' | 'Média' | 'Baixa' = 'Média';
    if (lower.includes('urgente') || lower.includes('alta') || lower.includes('prioridade alta')) {
      priority = 'Alta';
    } else if (lower.includes('baixa')) {
      priority = 'Baixa';
    }

    const taskPayload = {
      actionType,
      dueDate,
      dueTime,
      priority,
      notes: cleanNotes,
      clientId: matchedClient ? matchedClient.id : undefined,
      clientName: matchedClient ? matchedClient.name : undefined
    };

    const timeFormatted = dueTime ? ` às **${dueTime}**` : '';
    const clientFormatted = matchedClient ? ` com **${matchedClient.name}**` : '';
    const confirmationText = `Pronto, corretor! Criei a tarefa para **${dayLabel}** (${targetDate.toLocaleDateString('pt-BR')})${timeFormatted}${clientFormatted}: **${cleanNotes}**.\n\nA tarefa já está registrada no seu CRM e disponível na **Minha Rotina**. 🚀`;

    return {
      text: confirmationText,
      action: {
        type: 'create_task',
        task: taskPayload
      }
    };
  }

  // 1. Quem chamar hoje / Prioridades / Tarefas
  if (lower.includes("chamar") || lower.includes("prioridade") || lower.includes("hoje") || lower.includes("fazer")) {
    let res = `Olá, corretor! 👋 Com base na análise em tempo real da sua carteira no CRM, aqui estão as suas **prioridades absolutas para hoje**:\n\n`;

    if (priorities.length > 0) {
      res += `### 🔥 Leads de Alta Prioridade\n`;
      priorities.slice(0, 4).forEach((p: any) => {
        res += `- **${p.clientName}**: ${p.title} — *${p.description}*\n`;
      });
      res += `\n`;
    }

    if (overdueTasks.length > 0 || todayTasks.length > 0) {
      res += `### 📅 Compromissos & Tarefas Imediatas\n`;
      overdueTasks.slice(0, 3).forEach((t: any) => {
        res += `- ⚠️ **${t.clientName}** (Atrasada): ${t.title} — ${t.description}\n`;
      });
      todayTasks.slice(0, 3).forEach((t: any) => {
        res += `- 📌 **${t.clientName}**: ${t.title} — ${t.description}\n`;
      });
      res += `\n`;
    }

    if (priorities.length === 0 && overdueTasks.length === 0 && todayTasks.length === 0) {
      res += `Sua carteira está em dia! Uma excelente oportunidade para prospectar novos clientes ou resgatar contatos em *Em Atendimento*.\n\n`;
    }

    res += `💡 **Dica do Merlin**: Inicie o dia com os contatos de alta prioridade via WhatsApp e garanta a definição da *Data do Próximo Contato* para cada um.`;
    return { text: res, action: null };
  }

  // 2. Mensagem / Script para cliente específico
  if (lower.includes("mensagem") || lower.includes("script") || lower.includes("texto") || lower.includes("whatsapp") || lower.includes("abordagem")) {
    // Tenta encontrar o cliente citado
    const foundClient = clients.find((c: any) => c.name && lower.includes(c.name.toLowerCase()));
    
    if (foundClient) {
      const emp = foundClient.empreendimento || "o imóvel de seu interesse";
      return {
        text: `Aqui está uma sugestão de abordagem personalizada e humanizada para você enviar para **${foundClient.name}**:\n\n` +
          `---\n\n` +
          `"Oi ${foundClient.name}, tudo bem? Aqui é o seu corretor! 👋\n\n` +
          `Estive analisando algumas condições exclusivas sobre **${emp}** e lembrei imediatamente do seu perfil.\n\n` +
          `Consegui separar os detalhes e uma simulação atualizada. Como está sua disponibilidade para falarmos 2 minutinhos hoje?"\n\n` +
          `---\n\n` +
          `💡 *Copie a mensagem acima e envie no WhatsApp do cliente para reaquecer a negociação!*`,
        action: null
      };
    } else {
      const sampleClient = clients[0];
      const name = sampleClient ? sampleClient.name : "Cliente";
      const emp = sampleClient?.empreendimento || "o empreendimento";
      return {
        text: `Aqui está um modelo de abordagem de alto impacto que você pode adaptar para seus clientes:\n\n` +
          `---\n\n` +
          `"Olá, ${name}! Tudo bem com você? 👋\n\n` +
          `Estou passando rapidinho porque surgiram novidades importantes sobre as condições de **${emp}** e lembrei de você.\n\n` +
          `Podemos bater um papo rápido de 2 minutinhos ainda hoje para eu te mostrar?"\n\n` +
          `---\n\n` +
          `💡 *Você pode me pedir um script personalizado especificando o nome do cliente cadastrado na sua carteira!*`,
        action: null
      };
    }
  }

  // 3. Faturamento / Performance / Comissões
  if (lower.includes("faturamento") || lower.includes("comiss") || lower.includes("ganho") || lower.includes("venda") || lower.includes("meta")) {
    const formattedComm = totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return {
      text: `### 📊 Raio-X Financeiro & Performance\n\n` +
        `- **Comissões Acumuladas:** ${formattedComm}\n` +
        `- **Total de Vendas Registradas:** ${sales.length}\n` +
        `- **Carteira de Leads Ativos:** ${totalLeads} clientes cadastrados\n\n` +
        `🎯 **Estratégia para alavancar seu faturamento**:\n` +
        `1. Acelere os clientes em fase de **Proposta** e **Documentação** para transformar em comissão este mês.\n` +
        `2. Resgate leads em **Em Atendimento** com foco em agendar visitas presenciais no final de semana.`,
      action: null
    };
  }

  // 4. Auditoria da Carteira / Leads Frios
  if (lower.includes("auditoria") || lower.includes("carteira") || lower.includes("frio") || lower.includes("estagnado") || lower.includes("gargalo")) {
    return {
      text: `### 🔍 Diagnóstico Estratégico da Carteira\n\n` +
        `Identifiquei **${totalLeads} leads** cadastrados no seu CRM. Aqui estão os pontos de atenção:\n\n` +
        `- ⚠️ **Alertas de Gargalo:** ${alerts.length} oportunidades demandando intervenção.\n` +
        `- 🔥 **Prioridades Ativas:** ${priorities.length} clientes quentes para fechamento.\n\n` +
        `**Recomendações Táticas:**\n` +
        `1. **Resgate de Leads Estagnados**: Envie uma mensagem rápida com novidades de mercado ou novas unidades disponíveis.\n` +
        `2. **Padronização de Retorno**: Não deixe nenhum cliente sem data de próximo contato agendada.\n` +
        `3. **Foco em Visitas**: Transforme contatos digitais em visitas presenciais aos plantões ou imóveis.`,
      action: null
    };
  }

  // Resposta geral contextualizada do Merlin
  return {
    text: `Olá, corretor! 👋 Sou o **Merlin**, seu copiloto de vendas.\n\n` +
      `Estou conectado à sua carteira com **${totalLeads} leads** e **${sales.length} vendas registradas** (Total: R$ ${totalCommission.toLocaleString('pt-BR')}).\n\n` +
      `Como posso ajudar você a bater suas metas agora? Você pode me pedir:\n` +
      `- *"Merlin, amanhã às 8:30 quero fazer 20 retrabalhos."* (Eu crio a tarefa na sua Minha Rotina automaticamente!)\n` +
      `- *"Quais clientes devo chamar hoje?"*\n` +
      `- *"Crie uma mensagem para [Nome do Cliente]"*\n` +
      `- *"Como está meu faturamento e comissões?"*\n` +
      `- *"Faça uma auditoria rápida na minha carteira."*`,
    action: null
  };
}

// Extrai blocos estruturados ```merlin_action { ... } ```
function extractStructuredAction(rawText: string): { cleanText: string; action: any | null } {
  if (!rawText) return { cleanText: '', action: null };

  const actionMatch = rawText.match(/```(?:merlin_action|json:action|action)?\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1]);
      if (parsed && parsed.type === 'create_task' && parsed.task) {
        const cleanText = rawText.replace(/```(?:merlin_action|json:action|action)?\s*[\s\S]*?\s*```/g, '').trim();
        return { cleanText, action: parsed };
      }
    } catch (e) {
      // Ignora erro se não for JSON válido
    }
  }

  return { cleanText: rawText, action: null };
}

// API Route: Generate personalized copy/script for a lead
app.post("/api/gemini/generate-message", async (req, res) => {
  try {
    const { clientName, clientInterest, clientNotes, goal, clientStatus } = req.body;

    if (!clientName) {
      return res.status(400).json({ error: "O nome do cliente é obrigatório." });
    }

    const systemPrompt = `Você é o Merlin, um assistente virtual e especialista em copywriting para corretores de imóveis de alto desempenho.
Seu objetivo é criar mensagens de abordagem curtas, humanas, extremamente persuasivas e amigáveis para envio via WhatsApp ou Email.
Evite textos excessivamente formais, robóticos, artificiais ou repletos de jargões técnicos. Seja simpático, natural, direto ao ponto e focado em gerar conexão. Use quebras de linha e emojis com moderação para tornar a leitura agradável.`;

    const userPrompt = `Crie um script personalizado de abordagem rápida para o seguinte cliente:
- Nome do Cliente: ${clientName}
- Empreendimento de Interesse: ${clientInterest || "Não especificado ainda"}
- Perfil/Notas do Cliente: ${clientNotes || "Sem observações adicionais"}
- Etapa atual do Funil: ${clientStatus || "Lead Novo"}
- Objetivo da mensagem: ${goal || "Fazer um contato inicial para entender as necessidades"}

Instruções Adicionais:
- Escreva a mensagem em português do Brasil.
- A mensagem deve parecer escrita manualmente por um corretor de imóveis real (humanizado, amigável).
- Use o nome do cliente no início de forma natural.
- Tenha um gancho de chamada para ação claro (Call to Action), convidando para uma resposta simples ou um agendamento rápido de conversa.
- Retorne APENAS a mensagem pronta, sem introduções ou explicações.`;

    try {
      const ai = getGoogleGenAI();
      const text = await generateWithFallbackAndTimeout(ai, userPrompt, systemPrompt, 0.7);
      return res.json({ text });
    } catch (aiError: any) {
      console.warn("[Merlin Server] Gemini API indisponível, usando fallback inteligente de mensagem:", aiError.message);
      const emp = clientInterest || "as opções disponíveis";
      const fallbackText = `Olá, ${clientName}! Tudo bem com você? 👋\n\n` +
        `Estive analisando algumas condições exclusivas e novidades sobre **${emp}** e lembrei do seu perfil.\n\n` +
        `Separei detalhes atualizados e simulações especiais. Como está sua disponibilidade para falarmos 2 minutinhos hoje?`;
      return res.json({ text: fallbackText });
    }
  } catch (error: any) {
    console.error("Erro ao gerar mensagem:", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor ao gerar mensagem." });
  }
});

// API Route: Analyze overall CRM lead statistics and generate actionable recommendations
app.post("/api/gemini/analyze-leads", async (req, res) => {
  try {
    const { clientsSummary, salesCount, totalCommission } = req.body;

    const summary = clientsSummary || { totalCount: 0, noNextContactCount: 0, staleCount: 0, stageCounts: {} };
    const sales = salesCount !== undefined ? salesCount : 0;
    const commission = totalCommission !== undefined ? totalCommission : 0;

    const systemPrompt = `Você é o Merlin, um consultor estratégico e mentor de vendas de imóveis por inteligência artificial.
Seu papel é analisar a base de dados de leads de um corretor de imóveis e sugerir 3 recomendações táticas urgentes e extremamente acionáveis para aumentar as vendas e evitar perda de oportunidades.`;

    const userPrompt = `Analise a seguinte situação da base de leads do corretor:
- Total de Leads Cadastrados: ${summary.totalCount}
- Distribuição de Leads por Etapa do Funil:
${JSON.stringify(summary.stageCounts, null, 2)}
- Quantidade de Vendas Fechadas e Comissões: ${sales} vendas, com comissão total acumulada de R$ ${commission.toLocaleString('pt-BR')}
- Alertas e Gargalos Detectados:
  * Leads sem data de retorno agendada: ${summary.noNextContactCount}
  * Leads "frios/estagnados" sem contato há mais de 15 dias: ${summary.staleCount}

Com base nestes dados, gere exatamente 3 recomendações táticas bem estruturadas e práticas em português.
Seja direto, motivador e focado em resultados rápidos. Retorne a resposta em formato Markdown limpo, estruturado com títulos claros para cada recomendação.`;

    try {
      const ai = getGoogleGenAI();
      const text = await generateWithFallbackAndTimeout(ai, userPrompt, systemPrompt, 0.75);
      return res.json({ text });
    } catch (aiError: any) {
      console.warn("[Merlin Server] Gemini API indisponível, usando fallback inteligente de auditoria:", aiError.message);
      const fallbackText = `### 🎯 Auditoria Estratégica da Carteira\n\n` +
        `1. **Resgate Urgente de Oportunidades Estagnadas**\n` +
        `Você possui **${summary.staleCount || 0} leads sem contato há mais de 15 dias**. Envie hoje uma mensagem com gatilho de novidade ou tabela atualizada para reativar o interesse.\n\n` +
        `2. **Eliminação de Pontos Cegos no Funil**\n` +
        `Existem **${summary.noNextContactCount || 0} leads sem data de retorno agendada**. Defina imediatamente uma tarefa ou lembrete para cada um, evitando que leads quentes esfriem.\n\n` +
        `3. **Foco em Fechamentos e Visitas**\n` +
        `Com **${sales} vendas fechadas** e **R$ ${commission.toLocaleString('pt-BR')}** em comissões, priorize os clientes em fase de proposta e agendamento de visitas no final de semana para acelerar sua meta.`;
      return res.json({ text: fallbackText });
    }
  } catch (error: any) {
    console.error("Erro ao analisar base de leads:", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor ao analisar leads." });
  }
});

// API Route: Conversation with Merlin Assistant using CRM Context
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history, clients, tasks, sales, engineResult, brokerMemory, brokerLearnedProfile } = req.body;

    if (!message) {
      return res.status(400).json({ error: "A mensagem do usuário é obrigatória." });
    }

    // Serialize basic statistics for prompt injection
    const totalLeads = clients ? clients.length : 0;
    const salesCount = sales ? sales.length : 0;
    const totalCommission = sales ? sales.reduce((sum: number, sale: any) => sum + (sale.commissionValue || 0), 0) : 0;

    const clientsListBrief = clients ? clients.map((c: any) => ({
      name: c.name,
      phone: c.phone,
      status: c.status,
      empreendimento: c.empreendimento || "Nenhum",
      origem: c.origem || "Não informado",
      notes: c.notes || "",
      lastContactDate: c.lastContactDate || "",
      nextContactDate: c.nextContactDate || "",
      tags: c.tags || []
    })) : [];

    const prioritiesBrief = engineResult?.priorities ? engineResult.priorities.map((p: any) => ({
      clientName: p.clientName,
      title: p.title,
      description: p.description,
      severity: p.severity
    })) : [];

    const alertsBrief = engineResult?.alerts ? engineResult.alerts.map((a: any) => ({
      clientName: a.clientName,
      title: a.title,
      description: a.description,
      category: a.category
    })) : [];

    const todayTasksBrief = engineResult?.todayTasks ? engineResult.todayTasks.map((t: any) => ({
      clientName: t.clientName,
      title: t.title,
      description: t.description
    })) : [];

    const overdueTasksBrief = engineResult?.overdueTasks ? engineResult.overdueTasks.map((t: any) => ({
      clientName: t.clientName,
      title: t.title,
      description: t.description
    })) : [];

    const systemPrompt = `Você é o Merlin, o assistente comercial pessoal e consultor estratégico de vendas integrado ao CRM de um corretor de imóveis.
Sua personalidade é extremamente humana, prestativa, entusiasmada, direta, confiante e focada em resultados reais de vendas (fechar negócios, resgatar contatos e gerenciar tarefas de forma impecável).
O cérebro do Merlin é a IA, seus dados são o CRM, seus olhos são o Rules Engine e o chat é a sua forma de se comunicar.

Aqui estão os dados reais da carteira do corretor no CRM neste momento. Baseie suas respostas 100% nestes dados! Se o corretor pedir para preparar mensagens ou analisar clientes, cite apenas pessoas que realmente existam nesta lista:

1. CLIENTES CADASTRADOS (Total: ${totalLeads}):
${JSON.stringify(clientsListBrief.slice(0, 40), null, 2)}

2. ANÁLISE DO RULES ENGINE (OLHOS DO MERLIN):
- Clientes de Alta Prioridade: ${JSON.stringify(prioritiesBrief, null, 2)}
- Alertas e Gargalos Gerais: ${JSON.stringify(alertsBrief, null, 2)}
- Tarefas Agendadas para Hoje: ${JSON.stringify(todayTasksBrief, null, 2)}
- Tarefas Atrasadas/Pendentes: ${JSON.stringify(overdueTasksBrief, null, 2)}

3. DADOS DE VENDAS E PERFORMANCE:
- Quantidade de vendas fechadas: ${salesCount}
- Comissão acumulada do corretor: R$ ${totalCommission.toLocaleString('pt-BR')}

${brokerLearnedProfile ? `4. PERFIL DE TRABALHO E COMUNICAÇÃO DO CORRETOR (MEMÓRIA APRENDIDA):
- Estilo de Comunicação Aprendido: ${brokerLearnedProfile.communicationStyle}
- Forma de Abordagem Aprendida: ${brokerLearnedProfile.approachStyle}
- Preferências de Atendimento: ${brokerLearnedProfile.preferences}
- Padrões de Sucesso Aprendidos: ${brokerLearnedProfile.winningPatterns}

*Diretriz de Aprendizado*: Adapte todas as abordagens, scripts, sugestões de conversas e orientações aos pontos acima. Respeite o estilo e a forma de trabalho do corretor, aprimorando-a estrategicamente.
` : ''}

${brokerMemory && brokerMemory.length > 0 ? `5. HISTÓRICO RECENTE DE INTERAÇÕES E MEMÓRIA DE USO DO CORRETOR:
${JSON.stringify(brokerMemory.slice(0, 10), null, 2)}

*Diretriz de Uso*: Use este histórico para entender quais mensagens foram geradas, quais foram copiadas e quais interações (como comentários e status) o corretor executou ultimamente. Dê retornos acionáveis que usem esse contexto!
` : ''}

Diretrizes de resposta (Siga à risca!):
- Cumprimente o usuário tratando-o carinhosamente como "corretor" (ou pelo nome dele caso o sistema envie um nome específico de usuário autenticado no futuro, mas atualmente utilize o termo "corretor"). Nunca utilize referências fixas ao nome "Wesley". Ex: "Olá, corretor! 👋" ou "Bom dia, corretor!".
- Quando ele perguntar "quais clientes chamar hoje?", "o que fazer hoje?" ou "quais as prioridades?", faça uma síntese direta dos Clientes de Alta Prioridade e Tarefas Atrasadas. Cite os nomes deles e as ações recomendadas (ex: "João Silva - pendente de simulação há 5 dias"). Organize em formato de lista Markdown elegante.
- Se ele solicitar scripts ou mensagens para um cliente (ex: "Crie uma mensagem para a Franciene"), procure o cliente pelo nome aproximado nos Clientes Cadastrados. Se achar, use o empreendimento dele e o histórico para formular uma mensagem de WhatsApp fantástica, amigável, humana, natural, com quebras de linha e gatilhos amigáveis (ex: "Oi Franciene, tudo bem? Vi aqui que..."). Retorne o texto pronto para ser copiado. Se não achar o cliente por esse nome exato, pergunte educadamente sobre qual cliente ele está se referindo ou peça mais detalhes.
- Se ele pedir uma análise geral ou de performance da carteira, use os dados acima para destacar pontos fortes e os principais gargalos (ex: "Você tem X clientes sem retorno marcado. Vamos agendar para eles hoje?").
- Use sempre um tom profissional de parceria, de um gerente ou mentor que quer ver o corretor bater a meta de comissão acumulada (atualmente de R$ ${totalCommission.toLocaleString('pt-BR')}).
- Apresente tudo formatado de forma limpa, com subtítulos e bullet points, mas NUNCA mostre estruturas de código JSON na resposta final para o corretor.`;

    const userPrompt = `Histórico recente do chat:
${history ? history.map((h: any) => `${h.sender === "user" ? "Corretor" : "Merlin"}: ${h.text}`).join("\n") : ""}

Última mensagem do Corretor:
"${message}"

Escreva sua resposta de forma direta, amigável e extremamente acionável:`;

    try {
      const ai = getGoogleGenAI();
      const text = await generateWithFallbackAndTimeout(ai, userPrompt, systemPrompt, 0.75);
      return res.json({ text });
    } catch (aiError: any) {
      console.warn("[Merlin Server] Gemini API indisponível, usando fallback inteligente de chat:", aiError.message);
      const fallbackResponse = generateFallbackChatResponse(
        message,
        clients,
        sales,
        engineResult,
        brokerLearnedProfile
      );
      return res.json({ text: fallbackResponse });
    }
  } catch (error: any) {
    console.error("Erro no chat do Merlin:", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor no chat do Merlin." });
  }
});

// Serve frontend assets using Vite middleware or static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Merlin Server] Rodando com sucesso na porta ${PORT}`);
  });
}

startServer();
