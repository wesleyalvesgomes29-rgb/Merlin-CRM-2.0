export interface Env {
  GEMINI_API_KEY: string;
  DB?: any;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Função auxiliar resiliente com fallback de modelos e timeout
async function generateWithFallbackAndTimeout(
  apiKey: string,
  userPrompt: string,
  systemPrompt: string,
  temperature: number
): Promise<string> {
  const models = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Cloudflare Worker] Tentando gerar conteúdo usando modelo: ${model}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: temperature
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Cloudflare Worker] Conteúdo gerado com sucesso pelo modelo: ${model}`);
        return data.candidates[0].content.parts[0].text;
      }
      
      if (data.error) {
        throw new Error(`Erro da API Gemini: ${data.error.message || JSON.stringify(data.error)}`);
      }

      throw new Error(`O modelo ${model} retornou uma resposta em formato inesperado.`);
    } catch (error: any) {
      const msg = error.name === "AbortError" 
        ? `Timeout de 20 segundos atingido para o modelo ${model}.` 
        : (error.message || error);
      console.error(`[Cloudflare Worker] Falha ao gerar com modelo ${model}:`, msg);
      lastError = new Error(msg);
    }
  }

  throw lastError || new Error("Falha ao gerar conteúdo com todos os modelos disponíveis.");
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Tratar requisição OPTIONS para CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Roteamento
    if (path === "/api/gemini/generate-message") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "A variável de ambiente GEMINI_API_KEY não está configurada no Cloudflare Worker." }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const body: any = await request.json();
        const { clientName, clientInterest, clientNotes, goal, clientStatus } = body;

        if (!clientName) {
          return new Response(
            JSON.stringify({ error: "O nome do cliente é obrigatório." }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
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

        const text = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.7);

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error: any) {
        console.error("Erro no Worker generate-message:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Erro interno ao gerar mensagem." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (path === "/api/gemini/analyze-leads") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "A variável de ambiente GEMINI_API_KEY não está configurada no Cloudflare Worker." }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const body: any = await request.json();
        const { clientsSummary, salesCount, totalCommission } = body;

        const summary = clientsSummary || {
          totalCount: 0,
          noNextContactCount: 0,
          staleCount: 0,
          stageCounts: {}
        };

        const sales = salesCount !== undefined ? salesCount : 0;
        const commission = totalCommission !== undefined ? totalCommission : 0;

        const systemPrompt = `Você é o Merlin, um consultor estratégico e mentor de vendas de imóveis por inteligência artificial.
Seu papel é analisar a base de dados de leads de um corretor de imóveis e sugerir 3 recomendações táticas urgentes e extremamente acionáveis para aumentar as vendas e evitar perda de oportunidades.`;

        const userPrompt = `Analise a seguinte situação da base de leads do corretor:
- Total de Leads Cadastrados: ${summary.totalCount}
- Distribuição de Leads por Etapa do Funil:
${JSON.stringify(summary.stageCounts, null, 2)}
- Quantidade de Vendas Fechadas e Comissões: ${sales} vendas, com comissão total acumulada de R$ ${commission.toLocaleString("pt-BR")}
- Alertas e Gargalos Detectados:
  * Leads sem data de retorno agendada: ${summary.noNextContactCount}
  * Leads "frios/estagnados" sem contato há mais de 15 dias: ${summary.staleCount}

Com base nestes dados, gere exatamente 3 recomendações táticas bem estruturadas e práticas em português.
Seja direto, motivador e focado em resultados rápidos. Retorne a resposta em formato Markdown limpo, estruturado com títulos claros para cada recomendação.`;

        const text = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.75);

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error: any) {
        console.error("Erro no Worker analyze-leads:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Erro interno ao analisar leads." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (path === "/api/gemini/chat") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "A variável de ambiente GEMINI_API_KEY não está configurada no Cloudflare Worker." }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const body: any = await request.json();
        const { message, history, clients, tasks, sales, engineResult, brokerMemory, brokerLearnedProfile } = body;

        if (!message) {
          return new Response(
            JSON.stringify({ error: "A mensagem do usuário é obrigatória." }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
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
  2. REAGENDAR UMA TAREFA:
     \`\`\`merlin_action
     {
       "type": "reschedule_task",
       "taskId": "id_da_tarefa_existente",
       "newDueDate": "YYYY-MM-DD",
       "newDueTime": "HH:MM"
     }
     \`\`\`
  3. CONCLUIR UMA TAREFA:
     \`\`\`merlin_action
     {
       "type": "complete_task",
       "taskId": "id_da_tarefa_existente"
     }
     \`\`\`
  4. CANCELAR UMA TAREFA:
     \`\`\`merlin_action
     {
       "type": "cancel_task",
       "taskId": "id_da_tarefa_existente"
     }
     \`\`\`
- REGRAS CRÍTICAS:
  - NUNCA invente clientes, tarefas, datas ou horários que não foram informados.`;

        const userPrompt = `Histórico recente do chat:
${history ? history.map((h: any) => `${h.sender === "user" ? "Corretor" : "Merlin"}: ${h.text}`).join("\n") : ""}

Última mensagem do Corretor:
"${message}"

Escreva sua resposta de forma direta, amigável e extremamente acionável:`;

        const rawText = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.75);
        const { cleanText, action } = extractActionFromText(rawText);

        return new Response(JSON.stringify({ text: cleanText, action }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error: any) {
        console.error("Erro no Worker chat:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Erro interno no chat do Merlin." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (path === "/api/sync") {
      if (request.method === "GET") {
        try {
          if (!env.DB) {
            return new Response(
              JSON.stringify({
                success: true,
                isOfflineMode: true,
                message: "Cloudflare D1 não configurado neste ambiente Worker.",
                data: { clients: [], tasks: [], sales: [], tags: [] }
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          const [clientsResult, commentsResult, historyResult, tasksResult, salesResult, tagsResult] = await Promise.all([
            env.DB.prepare("SELECT * FROM clients ORDER BY created_at DESC").all(),
            env.DB.prepare("SELECT * FROM client_comments ORDER BY created_at DESC").all(),
            env.DB.prepare("SELECT * FROM client_history ORDER BY date DESC").all(),
            env.DB.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all(),
            env.DB.prepare("SELECT * FROM sales ORDER BY sale_date DESC").all(),
            env.DB.prepare("SELECT * FROM tags").all()
          ]);

          const commentsList = commentsResult.results || [];
          const historyList = historyResult.results || [];

          const clients = (clientsResult.results || []).map((row: any) => {
            let tagsParsed = [];
            try {
              tagsParsed = row.tags ? (typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags) : [];
            } catch {
              tagsParsed = row.tags ? [row.tags] : [];
            }

            return {
              id: row.id,
              name: row.name,
              phone: row.phone || "",
              email: row.email || "",
              empreendimento: row.empreendimento || "",
              origem: row.origem || "",
              status: row.status || "Lead Novo",
              notes: row.notes || "",
              tags: tagsParsed,
              nextContactDate: row.next_contact_date || null,
              contactCount: row.contact_count || 0,
              lastContactDate: row.last_contact_date || null,
              createdAt: row.created_at,
              comments: commentsList.filter((c: any) => c.client_id === row.id).map((c: any) => ({
                id: c.id,
                date: c.created_at,
                text: c.text
              })),
              history: historyList.filter((h: any) => h.client_id === row.id).map((h: any) => ({
                id: h.id,
                date: h.date,
                action: h.action
              }))
            };
          });

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                clients,
                tasks: (tasksResult.results || []).map((t: any) => ({
                  id: t.id,
                  clientId: t.client_id || undefined,
                  clientName: t.client_name || "",
                  actionType: t.action_type,
                  dueDate: t.due_date,
                  dueTime: t.due_time || undefined,
                  priority: t.priority || "Média",
                  completed: Boolean(t.completed),
                  notes: t.notes || "",
                  createdAt: t.created_at
                })),
                sales: (salesResult.results || []).map((s: any) => ({
                  id: s.id,
                  clientId: s.client_id || undefined,
                  clientName: s.client_name,
                  propertyName: s.property_name || undefined,
                  saleDate: s.sale_date,
                  vgv: s.vgv || 0,
                  commissionRate: s.commission_rate || 0,
                  commissionValue: s.commission_value || 0,
                  paymentStatus: s.payment_status || "Recebido",
                  notes: s.notes || ""
                })),
                tags: (tagsResult.results || []).map((tg: any) => ({
                  id: tg.id,
                  name: tg.name,
                  color: tg.color
                }))
              }
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } catch (error: any) {
          console.error("Erro no Worker GET /api/sync:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      if (request.method === "POST") {
        try {
          if (!env.DB) {
            return new Response(
              JSON.stringify({ success: true, isOfflineMode: true, syncedAt: new Date().toISOString() }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          const body: any = await request.json();
          const { clients, tasks, sales, tags } = body || {};
          const now = new Date().toISOString();
          const statements: any[] = [];

          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (tag && tag.id && tag.name) {
                statements.push(
                  env.DB.prepare(
                    `INSERT INTO tags (id, name, color) VALUES (?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color`
                  ).bind(tag.id, tag.name, tag.color || "")
                );
              }
            }
          }

          if (Array.isArray(sales)) {
            for (const sale of sales) {
              if (sale && sale.id && sale.clientName) {
                statements.push(
                  env.DB.prepare(
                    `INSERT INTO sales (id, client_id, client_name, property_name, sale_date, vgv, commission_rate, commission_value, payment_status, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                       client_id=excluded.client_id, client_name=excluded.client_name, property_name=excluded.property_name,
                       sale_date=excluded.sale_date, vgv=excluded.vgv, commission_rate=excluded.commission_rate,
                       commission_value=excluded.commission_value, payment_status=excluded.payment_status, notes=excluded.notes`
                  ).bind(
                    sale.id, sale.clientId || null, sale.clientName, sale.propertyName || null,
                    sale.saleDate || now.split("T")[0], sale.vgv || 0, sale.commissionRate || 0,
                    sale.commissionValue || 0, sale.paymentStatus || "Recebido", sale.notes || ""
                  )
                );
              }
            }
          }

          if (Array.isArray(tasks)) {
            for (const task of tasks) {
              if (task && task.id && task.actionType) {
                statements.push(
                  env.DB.prepare(
                    `INSERT INTO tasks (id, client_id, client_name, action_type, due_date, due_time, priority, completed, notes, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                       client_id=excluded.client_id, client_name=excluded.client_name, action_type=excluded.action_type,
                       due_date=excluded.due_date, due_time=excluded.due_time, priority=excluded.priority,
                       completed=excluded.completed, notes=excluded.notes`
                  ).bind(
                    task.id, task.clientId || null, task.clientName || "", task.actionType,
                    task.dueDate, task.dueTime || null, task.priority || "Média",
                    task.completed ? 1 : 0, task.notes || "", task.createdAt || now
                  )
                );
              }
            }
          }

          if (Array.isArray(clients)) {
            for (const client of clients) {
              if (client && client.id && client.name) {
                const tagsJson = JSON.stringify(Array.isArray(client.tags) ? client.tags : []);
                statements.push(
                  env.DB.prepare(
                    `INSERT INTO clients (id, name, phone, email, empreendimento, origem, status, notes, tags, next_contact_date, contact_count, last_contact_date, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                       name=excluded.name, phone=excluded.phone, email=excluded.email, empreendimento=excluded.empreendimento,
                       origem=excluded.origem, status=excluded.status, notes=excluded.notes, tags=excluded.tags,
                       next_contact_date=excluded.next_contact_date, contact_count=excluded.contact_count,
                       last_contact_date=excluded.last_contact_date, updated_at=excluded.updated_at`
                  ).bind(
                    client.id, client.name, client.phone || "", client.email || "", client.empreendimento || "", client.origem || "",
                    client.status || "Lead Novo", client.notes || "", tagsJson, client.nextContactDate || null,
                    client.contactCount || 0, client.lastContactDate || null, client.createdAt || now, now
                  )
                );

                if (Array.isArray(client.comments)) {
                  for (const comm of client.comments) {
                    if (comm && comm.id && comm.text) {
                      statements.push(
                        env.DB.prepare(
                          `INSERT INTO client_comments (id, client_id, text, created_at) VALUES (?, ?, ?, ?)
                           ON CONFLICT(id) DO UPDATE SET text=excluded.text`
                        ).bind(comm.id, client.id, comm.text, comm.date || comm.createdAt || now)
                      );
                    }
                  }
                }

                if (Array.isArray(client.history)) {
                  for (const hist of client.history) {
                    if (hist && hist.id && hist.action) {
                      statements.push(
                        env.DB.prepare(
                          `INSERT INTO client_history (id, client_id, action, date) VALUES (?, ?, ?, ?)
                           ON CONFLICT(id) DO NOTHING`
                        ).bind(hist.id, client.id, hist.action, hist.date || now)
                      );
                    }
                  }
                }
              }
            }
          }

          if (statements.length > 0) {
            const CHUNK_SIZE = 80;
            for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
              const chunk = statements.slice(i, i + CHUNK_SIZE);
              await env.DB.batch(chunk);
            }
          }

          return new Response(
            JSON.stringify({ success: true, syncedAt: now }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } catch (error: any) {
          console.error("Erro no Worker POST /api/sync:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // Para qualquer outra requisição, como o Cloudflare Worker moderno (wrangler v3 com assets)
    // servirá os arquivos estáticos da pasta dist automaticamente a partir da configuração wrangler.toml,
    // retornamos 404 apenas caso não encontre nenhum arquivo estático correspondente.
    return new Response("Not Found", { status: 404 });
  }
};
