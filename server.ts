import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  initLocalDatabase, 
  getAllData, 
  syncAllData, 
  registerUser, 
  loginUser, 
  findUserById, 
  createInviteCode, 
  listInviteCodes, 
  revokeInviteCode 
} from "./server/db";

dotenv.config();

// Inicializa banco de dados relacional local estruturado
initLocalDatabase();

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// MERLIN CRM - ROTAS DE AUTENTICAÇÃO E CONVITES
// ==========================================

// POST /api/auth/register: Cadastro restrito por código de convite
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "O nome completo é obrigatório." });
    }

    if (!email || !email.trim() || !email.includes("@")) {
      return res.status(400).json({ error: "Informe um endereço de e-mail válido." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
    }

    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: "O Código de Convite é obrigatório para cadastro." });
    }

    const result = await registerUser({
      name,
      email,
      password,
      inviteCode
    });

    if (!result.success) {
      // Se o erro foi relacionado a código inválido/expirado, retorna 403 conforme especificação
      if (result.error?.includes("convite")) {
        return res.status(403).json({ error: "Código de convite inválido ou expirado" });
      }
      return res.status(400).json({ error: result.error || "Erro ao realizar cadastro." });
    }

    return res.status(201).json({
      success: true,
      message: "Usuário cadastrado com sucesso!",
      user: result.user
    });
  } catch (error: any) {
    console.error("[Merlin Auth] Erro no registro:", error);
    return res.status(500).json({ error: error.message || "Erro interno no servidor ao registrar usuário." });
  }
});

// POST /api/auth/login: Autenticação por e-mail e senha
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const result = await loginUser(email, password);

    if (!result.success || !result.user) {
      return res.status(401).json({ error: result.error || "E-mail ou senha incorretos." });
    }

    return res.json({
      success: true,
      user: result.user
    });
  } catch (error: any) {
    console.error("[Merlin Auth] Erro no login:", error);
    return res.status(500).json({ error: error.message || "Erro interno no servidor ao realizar login." });
  }
});

// GET /api/auth/me: Validação de sessão do usuário
app.get("/api/auth/me", (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error: any) {
    console.error("[Merlin Auth] Erro no /api/auth/me:", error);
    return res.status(500).json({ error: "Erro ao consultar usuário." });
  }
});

// POST /api/admin/create-invite: Geração de novos códigos de convite por Administradores
app.post("/api/admin/create-invite", (req, res) => {
  try {
    const adminUserId = (req.headers["x-user-id"] as string) || req.body?.adminUserId;
    const { customCode } = req.body || {};

    if (!adminUserId) {
      return res.status(401).json({ error: "Identificação de administrador necessária." });
    }

    const result = createInviteCode(adminUserId, customCode);

    if (!result.success) {
      return res.status(403).json({ error: result.error || "Ação não autorizada." });
    }

    return res.status(201).json({
      success: true,
      invite: result.invite
    });
  } catch (error: any) {
    console.error("[Merlin Admin] Erro ao criar convite:", error);
    return res.status(500).json({ error: error.message || "Erro ao criar código de convite." });
  }
});

// GET /api/admin/invite-codes: Listagem de códigos de convite para Administradores
app.get("/api/admin/invite-codes", (req, res) => {
  try {
    const adminUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    if (!adminUserId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const user = findUserById(adminUserId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito a administradores." });
    }

    const invites = listInviteCodes();
    return res.json({
      success: true,
      invites
    });
  } catch (error: any) {
    console.error("[Merlin Admin] Erro ao listar convites:", error);
    return res.status(500).json({ error: "Erro ao listar códigos de convite." });
  }
});

// POST /api/admin/revoke-invite: Desativação de código de convite não utilizado
app.post("/api/admin/revoke-invite", (req, res) => {
  try {
    const adminUserId = (req.headers["x-user-id"] as string) || req.body?.adminUserId;
    const { code } = req.body || {};

    if (!adminUserId || !code) {
      return res.status(400).json({ error: "Parâmetros insuficientes." });
    }

    const result = revokeInviteCode(adminUserId, code);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Erro ao revogar convite." });
    }

    return res.json({ success: true, message: "Código de convite revogado." });
  } catch (error: any) {
    console.error("[Merlin Admin] Erro ao revogar convite:", error);
    return res.status(500).json({ error: "Erro ao revogar código de convite." });
  }
});

// ==========================================
// MERLIN CRM - ROTAS DE SINCRONIZAÇÃO E PERSISTÊNCIA (COM ISOLAMENTO)
// ==========================================

// GET /api/sync: Retorna todos os dados agrupados do CRM para o usuário autenticado
app.get("/api/sync", (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    const data = getAllData(userId);
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("[Merlin Server] Erro no GET /api/sync:", error);
    res.status(500).json({ success: false, error: error.message || "Erro ao consultar dados sincronizados." });
  }
});

// POST /api/sync: Recebe o payload e persiste os dados com segurança e isolamento
app.post("/api/sync", (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || req.body?.userId;
    const { clients, tasks, sales, tags } = req.body || {};
    const result = syncAllData({ clients, tasks, sales, tags }, userId);
    res.json(result);
  } catch (error: any) {
    console.error("[Merlin Server] Erro no POST /api/sync:", error);
    res.status(500).json({ success: false, error: error.message || "Erro ao persistir dados." });
  }
});


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
// Helper: extract structured action JSON from response text
function extractActionFromText(rawText: string): { cleanText: string; action: any | null } {
  let action: any = null;
  let cleanText = rawText;

  const actionBlockMatch = rawText.match(/```(?:merlin_action|json)?\s*(\{[\s\S]*?\})\s*```/);
  if (actionBlockMatch) {
    try {
      const parsed = JSON.parse(actionBlockMatch[1]);
      if (parsed && parsed.type) {
        action = parsed;
        cleanText = rawText.replace(actionBlockMatch[0], '').trim();
      }
    } catch (e) {
      // not valid action JSON
    }
  }

  return { cleanText, action };
}

// Fallback deterministic AI responses for when Gemini is offline or not configured
function generateFallbackChatResponse(
  message: string,
  clients: any[] = [],
  tasks: any[] = [],
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

  // Helper date calculator
  const calculateTargetDate = (text: string) => {
    const targetDate = new Date(refDate);
    let dayLabel = "hoje";
    const t = text.toLowerCase();

    if (t.includes("amanhã") || t.includes("amanha")) {
      targetDate.setDate(targetDate.getDate() + 1);
      dayLabel = "amanhã";
    } else if (t.includes("depois de amanhã") || t.includes("depois de amanha")) {
      targetDate.setDate(targetDate.getDate() + 2);
      dayLabel = "depois de amanhã";
    } else if (t.includes("segunda")) {
      const dist = (1 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "segunda-feira";
    } else if (t.includes("terça") || t.includes("terca")) {
      const dist = (2 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "terça-feira";
    } else if (t.includes("quarta")) {
      const dist = (3 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "quarta-feira";
    } else if (t.includes("quinta")) {
      const dist = (4 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "quinta-feira";
    } else if (t.includes("sexta")) {
      const dist = (5 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "sexta-feira";
    } else if (t.includes("sábado") || t.includes("sabado")) {
      const dist = (6 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "sábado";
    } else if (t.includes("domingo")) {
      const dist = (7 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + dist);
      dayLabel = "domingo";
    }

    return { targetDate, dueDate: formatDateStr(targetDate), dayLabel };
  };

  // Helper time extractor
  const extractDueTime = (text: string): string | undefined => {
    const timeMatch1 = text.match(/(\d{1,2}):(\d{2})/);
    const timeMatch2 = text.match(/(\d{1,2})\s*h(?:oras)?(?:\s*(\d{2}))?/i);
    const timeMatch3 = text.match(/(?:às|as|ás)\s*(\d{1,2})/i);

    if (timeMatch1) {
      return `${String(timeMatch1[1]).padStart(2, '0')}:${timeMatch1[2]}`;
    } else if (timeMatch2) {
      const h = String(timeMatch2[1]).padStart(2, '0');
      const m = timeMatch2[2] ? String(timeMatch2[2]).padStart(2, '0') : '00';
      return `${h}:${m}`;
    } else if (timeMatch3) {
      const h = String(timeMatch3[1]).padStart(2, '0');
      return `${h}:00`;
    }
    return undefined;
  };

  // Helper to find matching task in list with disambiguation
  const findMatchingTask = (query: string): { task: any | null; ambiguous?: boolean; candidates?: any[] } => {
    if (!tasks || tasks.length === 0) return { task: null };
    const queryLower = query.toLowerCase();

    // 1. Match by client name in task
    const matchedByClient = tasks.filter(t => {
      const clientName = (t.clientName || '').toLowerCase();
      return clientName && queryLower.includes(clientName);
    });
    if (matchedByClient.length === 1) {
      return { task: matchedByClient[0] };
    }
    if (matchedByClient.length > 1) {
      return { task: null, ambiguous: true, candidates: matchedByClient };
    }

    // 2. Match by distinct keywords in notes
    const matchedByNotes = tasks.filter(t => {
      const notes = (t.notes || '').toLowerCase();
      if (!notes) return false;
      const words = queryLower.split(/[\s,.:;!?-]+/).filter(w => w.length > 3 && !['segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado', 'domingo', 'amanhã', 'amanha', 'hoje', 'tarde', 'noite', 'manhã', 'manha', 'tarefa', 'para', 'fazer'].includes(w));
      return words.length > 0 && words.some(w => notes.includes(w));
    });
    if (matchedByNotes.length === 1) {
      return { task: matchedByNotes[0] };
    }
    if (matchedByNotes.length > 1) {
      return { task: null, ambiguous: true, candidates: matchedByNotes };
    }

    // 3. Pronoun resolution ("ela", "essa", "esta tarefa", "isso", "a tarefa"):
    // Check pending tasks
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 1) {
      return { task: pendingTasks[0] };
    }
    if (pendingTasks.length > 1) {
      // If ambiguous, return first as most recently manipulated/created or report candidates
      return { task: pendingTasks[0] };
    }

    return { task: tasks[0] };
  };

  // 1. CHECK: RESCHEDULE / ADIAR TAREFA
  const isRescheduleCommand = (
    // Joga / Jogue / Jogar
    lower.includes("joga ela") ||
    lower.includes("jogue ela") ||
    lower.includes("jogar ela") ||
    lower.includes("joga essa") ||
    lower.includes("jogue essa") ||
    lower.includes("joga esta") ||
    lower.includes("jogue esta") ||
    lower.includes("joga para") ||
    lower.includes("jogue para") ||
    lower.includes("jogar para") ||
    // Passa / Passe / Passar
    lower.includes("passa ela") ||
    lower.includes("passe ela") ||
    lower.includes("passar ela") ||
    lower.includes("passa essa") ||
    lower.includes("passe essa") ||
    lower.includes("passar essa") ||
    lower.includes("passa a tarefa") ||
    lower.includes("passe a tarefa") ||
    lower.includes("passar a tarefa") ||
    lower.includes("passa para") ||
    lower.includes("passe para") ||
    // Muda / Mude / Mudar
    lower.includes("muda ela") ||
    lower.includes("mude ela") ||
    lower.includes("mudar ela") ||
    lower.includes("muda essa") ||
    lower.includes("mude essa") ||
    lower.includes("mudar essa") ||
    lower.includes("muda a data") ||
    lower.includes("mude a data") ||
    lower.includes("mudar a data") ||
    lower.includes("muda o horário") ||
    lower.includes("mude o horário") ||
    lower.includes("muda o horario") ||
    lower.includes("mude o horario") ||
    lower.includes("mudar o horário") ||
    lower.includes("mudar o horario") ||
    lower.includes("muda para") ||
    lower.includes("mude para") ||
    // Adia / Adie / Adiar
    lower.includes("adia ela") ||
    lower.includes("adie ela") ||
    lower.includes("adiar ela") ||
    lower.includes("adia essa") ||
    lower.includes("adie essa") ||
    lower.includes("adiar essa") ||
    lower.includes("adia a tarefa") ||
    lower.includes("adie a tarefa") ||
    lower.includes("adiar a tarefa") ||
    lower.includes("adia tarefa") ||
    lower.includes("adie tarefa") ||
    lower.includes("adiar tarefa") ||
    lower.includes("adia para") ||
    lower.includes("adie para") ||
    // Reagenda / Reagende / Reagendar
    lower.includes("reagenda ela") ||
    lower.includes("reagende ela") ||
    lower.includes("reagendar ela") ||
    lower.includes("reagenda essa") ||
    lower.includes("reagende essa") ||
    lower.includes("reagendar essa") ||
    lower.includes("reagenda a tarefa") ||
    lower.includes("reagende a tarefa") ||
    lower.includes("reagendar a tarefa") ||
    lower.includes("reagenda tarefa") ||
    lower.includes("reagende tarefa") ||
    lower.includes("reagendar tarefa") ||
    lower.includes("reagenda para") ||
    lower.includes("reagende para")
  );

  if (isRescheduleCommand) {
    const matchResult = findMatchingTask(lower);
    if (matchResult.ambiguous && matchResult.candidates) {
      return {
        text: `Encontrei mais de uma tarefa pendente que pode ser essa (${matchResult.candidates.map(c => `"${c.notes || c.actionType}"`).join(" ou ")}). Qual delas você deseja reagendar, corretor?`,
        action: null
      };
    }

    const matchingTask = matchResult.task;
    if (!matchingTask) {
      return {
        text: `Não encontrei nenhuma tarefa correspondente para reagendar no momento, corretor! 🤔\n\nVocê pode me dizer qual tarefa deseja adiar ou abrir a **Minha Rotina** para conferir suas atividades.`,
        action: null
      };
    }

    const hasDateMention = (
      lower.includes("segunda") || lower.includes("terça") || lower.includes("terca") ||
      lower.includes("quarta") || lower.includes("quinta") || lower.includes("sexta") ||
      lower.includes("sábado") || lower.includes("sabado") || lower.includes("domingo") ||
      lower.includes("amanhã") || lower.includes("amanha") || lower.includes("hoje") ||
      lower.includes("depois de amanhã") || lower.includes("depois de amanha")
    );

    let finalDueDate = matchingTask.dueDate;
    let dayLabel = "data atual";
    if (hasDateMention) {
      const calc = calculateTargetDate(lower);
      finalDueDate = calc.dueDate;
      dayLabel = calc.dayLabel;
    }

    const dueTime = extractDueTime(lower) || matchingTask.dueTime;
    const timeFormatted = dueTime ? ` às **${dueTime}**` : '';
    const taskName = matchingTask.notes || matchingTask.actionType || 'Tarefa';

    return {
      text: `Pronto, corretor! Reagendei a tarefa **"${taskName}"** para **${hasDateMention ? dayLabel : finalDueDate}**${timeFormatted}. Sua **Minha Rotina** já foi atualizada! 🚀`,
      action: {
        type: 'reschedule_task',
        taskId: matchingTask.id,
        newDueDate: finalDueDate,
        newDueTime: dueTime,
        taskTitle: taskName
      }
    };
  }

  // 2. CHECK: CONCLUIR TAREFA
  const isCompleteCommand = (
    lower.includes("concluí essa") ||
    lower.includes("conclui essa") ||
    lower.includes("conclua essa") ||
    lower.includes("concluir essa") ||
    lower.includes("concluí ela") ||
    lower.includes("conclui ela") ||
    lower.includes("conclua ela") ||
    lower.includes("concluir ela") ||
    lower.includes("terminei essa") ||
    lower.includes("terminei ela") ||
    lower.includes("terminei a tarefa") ||
    lower.includes("conclui a tarefa") ||
    lower.includes("conclua a tarefa") ||
    lower.includes("concluir tarefa") ||
    lower.includes("marcar como concluída") ||
    lower.includes("marca como concluída") ||
    lower.includes("marcar como concluida") ||
    lower.includes("marca como concluida") ||
    lower.includes("pode marcar como concluíd") ||
    lower.includes("pode marcar como concluid") ||
    lower.includes("já liguei") ||
    lower.includes("ja liguei") ||
    lower.includes("já fiz") ||
    lower.includes("ja fiz") ||
    lower.includes("já enviei") ||
    lower.includes("ja enviei") ||
    lower.includes("já mandei") ||
    lower.includes("ja mandei")
  );

  if (isCompleteCommand) {
    const matchResult = findMatchingTask(lower);
    if (matchResult.ambiguous && matchResult.candidates) {
      return {
        text: `Encontrei mais de uma tarefa pendente (${matchResult.candidates.map(c => `"${c.notes || c.actionType}"`).join(" ou ")}). Qual delas você concluiu, corretor?`,
        action: null
      };
    }

    const matchingTask = matchResult.task;
    if (!matchingTask) {
      return {
        text: `Não encontrei tarefas pendentes correspondentes para marcar como concluída, corretor! 🤔\n\nCaso queira, dê uma olhadinha na aba **Minha Rotina**.`,
        action: null
      };
    }

    const taskName = matchingTask.notes || matchingTask.actionType || 'Tarefa';

    return {
      text: `Sensacional, corretor! Marquei a tarefa **"${taskName}"** como **concluída** no seu CRM. Mais um passo em direção ao fechamento! ✅`,
      action: {
        type: 'complete_task',
        taskId: matchingTask.id,
        taskTitle: taskName
      }
    };
  }

  // 3. CHECK: CANCELAR / EXCLUIR TAREFA
  const isCancelCommand = (
    lower.includes("cancela essa") ||
    lower.includes("cancele essa") ||
    lower.includes("cancelar essa") ||
    lower.includes("cancela ela") ||
    lower.includes("cancele ela") ||
    lower.includes("cancelar ela") ||
    lower.includes("cancela a tarefa") ||
    lower.includes("cancelar a tarefa") ||
    lower.includes("cancela tarefa") ||
    lower.includes("cancelar tarefa") ||
    lower.includes("não preciso mais fazer") ||
    lower.includes("nao preciso mais fazer") ||
    lower.includes("exclui essa") ||
    lower.includes("exclua essa") ||
    lower.includes("excluir essa") ||
    lower.includes("exclui ela") ||
    lower.includes("exclua ela") ||
    lower.includes("excluir ela") ||
    lower.includes("apaga essa") ||
    lower.includes("apague essa") ||
    lower.includes("apagar essa")
  );

  if (isCancelCommand) {
    const matchResult = findMatchingTask(lower);
    if (matchResult.ambiguous && matchResult.candidates) {
      return {
        text: `Encontrei mais de uma tarefa (${matchResult.candidates.map(c => `"${c.notes || c.actionType}"`).join(" ou ")}). Qual delas você deseja cancelar, corretor?`,
        action: null
      };
    }

    const matchingTask = matchResult.task;
    if (!matchingTask) {
      return {
        text: `Não localizei a tarefa que você deseja cancelar, corretor! 🤔\n\nQualquer dúvida, você pode gerenciá-la diretamente na aba **Minha Rotina**.`,
        action: null
      };
    }

    const taskName = matchingTask.notes || matchingTask.actionType || 'Tarefa';

    return {
      text: `Pronto, corretor! Removi a tarefa **"${taskName}"** da sua **Minha Rotina**. 🗑️`,
      action: {
        type: 'cancel_task',
        taskId: matchingTask.id,
        taskTitle: taskName
      }
    };
  }

  // 4. CHECK: TASK CREATION COMMAND VS MERE STATEMENT
  const isCreationCommand = (
    lower.includes("quero fazer") ||
    lower.includes("quero agendar") ||
    lower.includes("crie uma tarefa") ||
    lower.includes("criar uma tarefa") ||
    lower.includes("crie a tarefa") ||
    lower.includes("cria uma tarefa") ||
    lower.includes("criar tarefa") ||
    lower.includes("crie tarefa") ||
    lower.includes("cria tarefa") ||
    lower.includes("adicione na rotina") ||
    lower.includes("adicione na minha rotina") ||
    lower.includes("coloque na minha rotina") ||
    lower.includes("coloque na rotina") ||
    lower.includes("agende uma tarefa") ||
    lower.includes("agendar uma tarefa") ||
    lower.includes("agendar tarefa") ||
    lower.includes("agende para") ||
    lower.includes("agendar para") ||
    lower.includes("crie para") ||
    lower.includes("cria para") ||
    lower.includes("marca para") ||
    lower.includes("marque para") ||
    lower.includes("marcar para") ||
    lower.includes("lembre-me de") ||
    lower.includes("me lembra de") ||
    lower.includes("me lembre de")
  );

  const isMereStatement = (
    !isCreationCommand && (
      lower.includes("preciso fazer") ||
      lower.includes("tenho que fazer") ||
      lower.includes("preciso ligar") ||
      lower.includes("tenho que ligar") ||
      lower.includes("devo fazer") ||
      lower.includes("vou fazer")
    )
  );

  // If it is a mere statement without explicit command, ask safely without inventing action
  if (isMereStatement) {
    return {
      text: `Entendi que você tem esse compromisso em mente, corretor! 🤔\n\nVocê gostaria que eu **crie essa tarefa na sua Minha Rotina**? Se sim, me confirme em qual data e horário você prefere (ex: *"Merlin, crie a tarefa para amanhã às 08:30"*).`,
      action: null
    };
  }

  // If it IS a clear task creation command
  if (isCreationCommand) {
    // 1. Calculate Date
    const { targetDate, dueDate, dayLabel } = calculateTargetDate(lower);

    // 2. Extract Time
    const dueTime = extractDueTime(message);

    // 3. Extract Client if mentioned
    let matchedClient: any = undefined;
    if (clients && clients.length > 0) {
      // Find matching client
      const potentialClients = clients.filter((c: any) => c.name && lower.includes(c.name.toLowerCase()));
      if (potentialClients.length === 1) {
        matchedClient = potentialClients[0];
      } else if (potentialClients.length > 1) {
        return {
          text: `Encontrei mais de um cliente compatível com esse nome (${potentialClients.map((c: any) => c.name).join(", ")}). Para qual deles você deseja criar a tarefa?`,
          action: null
        };
      }
    }

    // 4. Extract Action Type
    let actionType = 'Outro';
    if (lower.includes('retrabalho') || lower.includes('whatsapp') || lower.includes('whats') || lower.includes('zap') || lower.includes('mensagem') || lower.includes('msg')) {
      actionType = 'WhatsApp';
    } else if (lower.includes('ligar') || lower.includes('ligação') || lower.includes('ligacao') || lower.includes('telefone') || lower.includes('chamar')) {
      actionType = 'Ligação';
    } else if (lower.includes('visita') || lower.includes('visitar') || lower.includes('decorado') || lower.includes('imóvel') || lower.includes('imovel') || lower.includes('plantão') || lower.includes('plantao')) {
      actionType = 'Visita ao Imóvel';
    } else if (lower.includes('proposta') || lower.includes('enviar proposta') || lower.includes('simulação') || lower.includes('simulacao')) {
      actionType = 'Enviar Proposta';
    } else if (lower.includes('reunião') || lower.includes('reuniao') || lower.includes('alinhamento')) {
      actionType = 'Reunião';
    } else if (lower.includes('contrato') || lower.includes('documento') || lower.includes('docs')) {
      actionType = 'Contrato / Docs';
    }

    // 5. Extract Notes / Description
    let cleanNotes = message;
    cleanNotes = cleanNotes
      .replace(/^merlin[,\s:]*/i, '')
      .replace(/(?:por favor|quero|crie|criar|cria|agende|agendar|adicione|coloque|marca|marque|marcar|me\s+lembra\s+de|me\s+lembre\s+de|lembre-me\s+de)\s*(?:uma\s+tarefa|na\s+rotina|na\s+minha\s+rotina|para|a\s+tarefa)*/gi, '')
      .replace(/(?:amanhã|amanha|hoje|depois de amanhã|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo)/gi, '')
      .replace(/(?:às|as|ás|\sat\s)\s*\d{1,2}(?::\d{2}|h(?:\d{2})?)/gi, '')
      .replace(/^[\s,.:;!?-]+/, '')
      .replace(/^(?:para\s+eu\s+|para\s+mim\s+|para\s+|de\s+|que\s+|eu\s+)+/i, '')
      .replace(/^[\s,.:;!?-]+/, '')
      .trim();

    // If description is missing/empty, ask user for details without creating arbitrary task
    if (!cleanNotes || cleanNotes.length < 2) {
      if (lower.includes('tarefa para')) {
        return {
          text: `Com certeza, corretor! O que você gostaria que eu colocasse como descrição/ação dessa tarefa?`,
          action: null
        };
      }
      cleanNotes = 'Tarefa comercial';
    } else {
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

    const activeTasksBrief = tasks ? tasks.slice(0, 30).map((t: any) => ({
      id: t.id,
      clientName: t.clientName || "Sem cliente",
      actionType: t.actionType,
      dueDate: t.dueDate,
      dueTime: t.dueTime || "",
      notes: t.notes || "",
      priority: t.priority || "Média",
      completed: t.completed || false
    })) : [];

    const systemPrompt = `Você é o Merlin, o assistente comercial pessoal e consultor estratégico de vendas integrado ao CRM de um corretor de imóveis (Merlin Second Brain).
Sua personalidade é extremamente humana, prestativa, entusiasmada, direta, confiante e focada em resultados reais de vendas (fechar negócios, resgatar contatos e gerenciar tarefas de forma impecável).
O cérebro do Merlin é a IA, seus dados são o CRM, seus olhos são o Rules Engine e o chat é a sua forma de se comunicar.

Aqui estão os dados reais da carteira do corretor no CRM neste momento. Baseie suas respostas 100% nestes dados! Se o corretor pedir para preparar mensagens, analisar clientes ou gerenciar tarefas, cite apenas pessoas e tarefas que realmente existam nesta lista:

1. CLIENTES CADASTRADOS (Total: ${totalLeads}):
${JSON.stringify(clientsListBrief.slice(0, 40), null, 2)}

2. TAREFAS ATUAIS NA ROTINA DO CORRETOR:
${JSON.stringify(activeTasksBrief, null, 2)}

3. ANÁLISE DO RULES ENGINE (OLHOS DO MERLIN):
- Clientes de Alta Prioridade: ${JSON.stringify(prioritiesBrief, null, 2)}
- Alertas e Gargalos Gerais: ${JSON.stringify(alertsBrief, null, 2)}
- Tarefas Agendadas para Hoje: ${JSON.stringify(todayTasksBrief, null, 2)}
- Tarefas Atrasadas/Pendentes: ${JSON.stringify(overdueTasksBrief, null, 2)}

4. DADOS DE VENDAS E PERFORMANCE:
- Quantidade de vendas fechadas: ${salesCount}
- Comissão acumulada do corretor: R$ ${totalCommission.toLocaleString('pt-BR')}

${brokerLearnedProfile ? `5. PERFIL DE TRABALHO E COMUNICAÇÃO DO CORRETOR (MEMÓRIA APRENDIDA):
- Estilo de Comunicação Aprendido: ${brokerLearnedProfile.communicationStyle}
- Forma de Abordagem Aprendida: ${brokerLearnedProfile.approachStyle}
- Preferências de Atendimento: ${brokerLearnedProfile.preferences}
- Padrões de Sucesso Aprendidos: ${brokerLearnedProfile.winningPatterns}

*Diretriz de Aprendizado*: Adapte todas as abordagens, scripts, sugestões de conversas e orientações aos pontos acima. Respeite o estilo e a forma de trabalho do corretor, aprimorando-a estrategicamente.
` : ''}

${brokerMemory && brokerMemory.length > 0 ? `6. HISTÓRICO RECENTE DE INTERAÇÕES E MEMÓRIA DE USO DO CORRETOR:
${JSON.stringify(brokerMemory.slice(0, 10), null, 2)}

*Diretriz de Uso*: Use este histórico para entender quais mensagens foram geradas, quais foram copiadas e quais interações o corretor executou ultimamente.
` : ''}

Diretrizes de resposta (Siga à risca!):
- Cumprimente o usuário tratando-o carinhosamente como "corretor".
- Quando ele perguntar "quais clientes chamar hoje?", "o que fazer hoje?" ou "quais as prioridades?", faça uma síntese direta dos Clientes de Alta Prioridade e Tarefas Atrasadas. Cite os nomes deles e as ações recomendadas.
- Se ele solicitar scripts ou mensagens para um cliente, formule mensagens naturais de WhatsApp prontas para envio.
- GESTÃO DE TAREFAS (MERLIN SECOND BRAIN):
  Se o corretor pedir explicitamente para:
  1. CRIAR UMA TAREFA (ex: "Cria uma tarefa para amanhã às 8:30 para eu fazer 20 retrabalhos", "Me lembra de ligar para o João amanhã às 14h"):
     Se faltar a descrição do que fazer, pergunte ao corretor o que deve ser feito e NÃO crie ação.
     Se houver descrição clara, confirme amigavelmente e inclua no final da resposta o bloco:
     \`\`\`merlin_action
     {
       "type": "create_task",
       "task": {
         "clientId": "id_do_cliente_se_houver",
         "clientName": "nome_do_cliente_se_houver",
         "actionType": "WhatsApp" | "Ligação" | "Visita ao Imóvel" | "Enviar Proposta" | "Reunião" | "Contrato / Docs" | "Outro",
         "dueDate": "YYYY-MM-DD",
         "dueTime": "HH:MM",
         "priority": "Alta" | "Média" | "Baixa",
         "notes": "Descrição da tarefa"
       }
     }
     \`\`\`
  2. REAGENDAR UMA TAREFA (ex: "Passa essa tarefa para amanhã", "Joga a ligação da Maria para sexta às 15h"):
     Identifique a tarefa pelo nome do cliente ou descrição nas Tarefas Atuais. Inclua no final:
     \`\`\`merlin_action
     {
       "type": "reschedule_task",
       "taskId": "id_da_tarefa_existente",
       "newDueDate": "YYYY-MM-DD",
       "newDueTime": "HH:MM"
     }
     \`\`\`
  3. CONCLUIR UMA TAREFA (ex: "Terminei essa tarefa", "Pode marcar os 20 retrabalhos como concluídos", "Já liguei para o João"):
     Identifique a tarefa nas Tarefas Atuais. Inclua no final:
     \`\`\`merlin_action
     {
       "type": "complete_task",
       "taskId": "id_da_tarefa_existente"
     }
     \`\`\`
  4. CANCELAR UMA TAREFA (ex: "Cancela essa tarefa", "Não preciso mais fazer essa ligação"):
     Identifique a tarefa nas Tarefas Atuais. Inclua no final:
     \`\`\`merlin_action
     {
       "type": "cancel_task",
       "taskId": "id_da_tarefa_existente"
     }
     \`\`\`
- REGRAS CRÍTICAS:
  - NUNCA invente clientes, tarefas, datas ou horários que não foram informados.
  - Se for apenas um desabafo/afirmação sem comando explícito (ex: "Preciso fazer retrabalho amanhã"), apenas pergunte educadamente se deseja agendar na Minha Rotina.`;

    const userPrompt = `Histórico recente do chat:
${history ? history.map((h: any) => `${h.sender === "user" ? "Corretor" : "Merlin"}: ${h.text}`).join("\n") : ""}

Última mensagem do Corretor:
"${message}"

Escreva sua resposta de forma direta, amigável e extremamente acionável:`;

    try {
      const ai = getGoogleGenAI();
      const rawText = await generateWithFallbackAndTimeout(ai, userPrompt, systemPrompt, 0.75);
      const { cleanText, action } = extractActionFromText(rawText);
      return res.json({ text: cleanText, action });
    } catch (aiError: any) {
      console.warn("[Merlin Server] Gemini API indisponível, usando fallback inteligente de chat:", aiError.message);
      const fallbackResponse = generateFallbackChatResponse(
        message,
        clients,
        tasks,
        sales,
        engineResult,
        brokerLearnedProfile
      );
      return res.json(fallbackResponse);
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
