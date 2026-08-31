import { 
  getAuthCorsHeaders, 
  hashPasswordWithSalt, 
  generateRandomSalt, 
  generateRandomInviteCode,
  MASTER_INVITE_CODE,
  jsonResponse, 
  errorResponse,
  Env,
  PagesFunction
} from "./auth/_auth_utils";
import { generateWithFallbackAndTimeout } from "./gemini/_utils";

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const corsHeaders = getAuthCorsHeaders(context.request);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, ""); // normalize trailing slashes
  const method = request.method.toUpperCase();

  try {
    // -------------------------------------------------------------
    // 1. Health check: GET /api/health
    // -------------------------------------------------------------
    if (pathname === "/api/health" || pathname === "/api") {
      return jsonResponse({
        status: "ok",
        service: "Merlin CRM Cloudflare Pages Functions",
        d1Configured: !!env.DB,
        timestamp: new Date().toISOString(),
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 2. Auth: POST /api/auth/register
    // -------------------------------------------------------------
    if (pathname === "/api/auth/register") {
      if (method !== "POST") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return errorResponse("Formato JSON inválido no corpo da requisição.", 400, corsHeaders);
      }

      const { name, email, password, inviteCode } = body || {};

      if (!name || !name.trim()) {
        return errorResponse("O nome completo é obrigatório.", 400, corsHeaders);
      }
      if (!email || !email.trim() || !email.includes("@")) {
        return errorResponse("Informe um endereço de e-mail válido.", 400, corsHeaders);
      }
      if (!password || password.length < 6) {
        return errorResponse("A senha deve ter no mínimo 6 caracteres.", 400, corsHeaders);
      }
      if (!inviteCode || !inviteCode.trim()) {
        return errorResponse("O Código de Convite é obrigatório.", 400, corsHeaders);
      }

      const emailNorm = email.trim().toLowerCase();
      const codeNorm = inviteCode.trim().toUpperCase();
      const isMaster = codeNorm === MASTER_INVITE_CODE;

      if (!env.DB) {
        // Fallback local caso D1 não esteja configurado
        return jsonResponse({
          success: true,
          user: {
            id: "usr_" + Math.random().toString(36).substring(2, 9),
            name: name.trim(),
            email: emailNorm,
            role: isMaster ? "admin" : "broker",
            createdAt: new Date().toISOString(),
          },
        }, 201, corsHeaders);
      }

      // Verifica se usuário já existe
      const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(emailNorm).first<any>();
      if (existingUser) {
        return errorResponse("Este e-mail já está cadastrado.", 400, corsHeaders);
      }

      // Valida código de convite
      const role = isMaster ? "admin" : "broker";
      if (!isMaster) {
        const invite = await env.DB.prepare("SELECT * FROM invite_codes WHERE code = ?").bind(codeNorm).first<any>();
        if (!invite || invite.is_active !== 1 || invite.used_by) {
          return errorResponse("Código de convite inválido ou expirado", 403, corsHeaders);
        }
      }

      const userId = "usr_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const salt = generateRandomSalt();
      const passwordHash = await hashPasswordWithSalt(password, salt);
      const now = new Date().toISOString();

      await env.DB.prepare(
        "INSERT INTO users (id, name, email, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(userId, name.trim(), emailNorm, passwordHash, salt, role, now).run();

      if (!isMaster) {
        await env.DB.prepare(
          "UPDATE invite_codes SET used_by = ?, used_at = ?, is_active = 0 WHERE code = ?"
        ).bind(userId, now, codeNorm).run();
      }

      return jsonResponse({
        success: true,
        user: {
          id: userId,
          name: name.trim(),
          email: emailNorm,
          role,
          createdAt: now,
        },
      }, 201, corsHeaders);
    }

    // -------------------------------------------------------------
    // 3. Auth: POST /api/auth/login
    // -------------------------------------------------------------
    if (pathname === "/api/auth/login") {
      if (method !== "POST") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return errorResponse("Formato JSON inválido no corpo da requisição.", 400, corsHeaders);
      }

      const { email, password } = body || {};
      if (!email || !password) {
        return errorResponse("E-mail e senha são obrigatórios.", 400, corsHeaders);
      }

      const emailNorm = email.trim().toLowerCase();

      if (!env.DB) {
        return jsonResponse({
          success: true,
          user: {
            id: "usr_mock",
            name: "Corretor Merlin",
            email: emailNorm,
            role: "admin",
            createdAt: new Date().toISOString(),
          },
        }, 200, corsHeaders);
      }

      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(emailNorm).first<any>();
      if (!user) {
        return errorResponse("E-mail ou senha incorretos.", 401, corsHeaders);
      }

      const computedHash = await hashPasswordWithSalt(password, user.salt);
      if (computedHash !== user.password_hash) {
        return errorResponse("E-mail ou senha incorretos.", 401, corsHeaders);
      }

      return jsonResponse({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
        },
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4. Auth: GET /api/auth/me
    // -------------------------------------------------------------
    if (pathname === "/api/auth/me") {
      if (method !== "GET") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      if (!userId) {
        return errorResponse("Não autenticado.", 401, corsHeaders);
      }

      if (!env.DB) {
        return jsonResponse({
          success: true,
          user: {
            id: userId,
            name: "Corretor",
            email: "corretor@merlin.crm",
            role: "admin",
            createdAt: new Date().toISOString(),
          },
        }, 200, corsHeaders);
      }

      const user = await env.DB.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").bind(userId).first<any>();
      if (!user) {
        return errorResponse("Usuário não encontrado.", 404, corsHeaders);
      }

      return jsonResponse({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
        },
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 5. Admin: POST /api/admin/create-invite
    // -------------------------------------------------------------
    if (pathname === "/api/admin/create-invite") {
      if (method !== "POST") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      const adminUserId = request.headers.get("X-User-Id");
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const { customCode, adminUserId: bodyAdminId } = body || {};
      const effectiveAdminId = adminUserId || bodyAdminId;

      if (!effectiveAdminId) {
        return errorResponse("Acesso não autorizado.", 401, corsHeaders);
      }

      const code = (customCode ? customCode.trim().toUpperCase() : generateRandomInviteCode()).replace(/\s+/g, "-");

      if (!env.DB) {
        return jsonResponse({
          success: true,
          invite: {
            code,
            created_by: effectiveAdminId,
            used_by: null,
            used_at: null,
            is_active: 1,
            created_at: new Date().toISOString(),
          },
        }, 201, corsHeaders);
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first<any>();
      if (!user || user.role !== "admin") {
        return errorResponse("Apenas administradores podem gerar códigos de convite.", 403, corsHeaders);
      }

      const existing = await env.DB.prepare("SELECT code FROM invite_codes WHERE code = ?").bind(code).first<any>();
      if (existing) {
        return errorResponse("Este código de convite já existe.", 400, corsHeaders);
      }

      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO invite_codes (code, created_by, used_by, used_at, is_active, created_at) VALUES (?, ?, NULL, NULL, 1, ?)"
      ).bind(code, effectiveAdminId, now).run();

      return jsonResponse({
        success: true,
        invite: {
          code,
          created_by: effectiveAdminId,
          used_by: null,
          used_at: null,
          is_active: 1,
          created_at: now,
        },
      }, 201, corsHeaders);
    }

    // -------------------------------------------------------------
    // 6. Admin: GET /api/admin/invite-codes
    // -------------------------------------------------------------
    if (pathname === "/api/admin/invite-codes") {
      if (method !== "GET") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      const adminUserId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      if (!adminUserId) {
        return errorResponse("Acesso não autorizado.", 401, corsHeaders);
      }

      if (!env.DB) {
        return jsonResponse({
          success: true,
          invites: [
            {
              code: "MERLIN-ADMIN-2026",
              created_by: "Sistema",
              used_by: null,
              used_at: null,
              is_active: 1,
              created_at: new Date().toISOString(),
            },
          ],
        }, 200, corsHeaders);
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(adminUserId).first<any>();
      if (!user || user.role !== "admin") {
        return errorResponse("Apenas administradores podem visualizar convites.", 403, corsHeaders);
      }

      const query = `
        SELECT 
          i.code,
          i.created_by,
          i.used_by,
          i.used_at,
          i.is_active,
          i.created_at,
          u.name as used_by_name,
          u.email as used_by_email
        FROM invite_codes i
        LEFT JOIN users u ON i.used_by = u.id
        ORDER BY i.created_at DESC
      `;
      const result = await env.DB.prepare(query).all();

      return jsonResponse({
        success: true,
        invites: result.results || [],
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 7. Admin: POST /api/admin/revoke-invite
    // -------------------------------------------------------------
    if (pathname === "/api/admin/revoke-invite") {
      if (method !== "POST") {
        return errorResponse("Método não permitido.", 405, corsHeaders);
      }

      const adminUserId = request.headers.get("X-User-Id");
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const { code, adminUserId: bodyAdminId } = body || {};
      const effectiveAdminId = adminUserId || bodyAdminId;

      if (!effectiveAdminId || !code) {
        return errorResponse("Parâmetros insuficientes.", 400, corsHeaders);
      }

      if (!env.DB) {
        return jsonResponse({ success: true, message: "Código revogado." }, 200, corsHeaders);
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first<any>();
      if (!user || user.role !== "admin") {
        return errorResponse("Acesso restrito a administradores.", 403, corsHeaders);
      }

      const codeNorm = code.trim().toUpperCase();
      await env.DB.prepare("UPDATE invite_codes SET is_active = 0 WHERE code = ?").bind(codeNorm).run();

      return jsonResponse({ success: true, message: "Código de convite revogado com sucesso." }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 8. Sync: GET /api/sync & POST /api/sync
    // -------------------------------------------------------------
    if (pathname === "/api/sync") {
      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");

      if (method === "GET") {
        if (!env.DB) {
          return jsonResponse({
            success: true,
            isOfflineMode: true,
            message: "Banco Cloudflare D1 não vinculado diretamente. Operando via cache local resiliente.",
            data: { clients: [], tasks: [], sales: [], tags: [] },
          }, 200, corsHeaders);
        }

        const clientsQuery = userId
          ? env.DB.prepare("SELECT * FROM clients WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY created_at DESC").bind(userId)
          : env.DB.prepare("SELECT * FROM clients ORDER BY created_at DESC");

        const tasksQuery = userId
          ? env.DB.prepare("SELECT * FROM tasks WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY created_at DESC").bind(userId)
          : env.DB.prepare("SELECT * FROM tasks ORDER BY created_at DESC");

        const salesQuery = userId
          ? env.DB.prepare("SELECT * FROM sales WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY sale_date DESC").bind(userId)
          : env.DB.prepare("SELECT * FROM sales ORDER BY sale_date DESC");

        const [
          clientsResult,
          commentsResult,
          historyResult,
          tasksResult,
          salesResult,
          tagsResult
        ] = await Promise.all([
          clientsQuery.all(),
          env.DB.prepare("SELECT * FROM client_comments ORDER BY created_at DESC").all(),
          env.DB.prepare("SELECT * FROM client_history ORDER BY date DESC").all(),
          tasksQuery.all(),
          salesQuery.all(),
          env.DB.prepare("SELECT * FROM tags").all()
        ]);

        const commentsByClient: Record<string, any[]> = {};
        for (const c of (commentsResult.results || [])) {
          if (!commentsByClient[c.client_id]) commentsByClient[c.client_id] = [];
          commentsByClient[c.client_id].push({
            id: c.id,
            text: c.text,
            createdAt: c.created_at,
          });
        }

        const historyByClient: Record<string, any[]> = {};
        for (const h of (historyResult.results || [])) {
          if (!historyByClient[h.client_id]) historyByClient[h.client_id] = [];
          historyByClient[h.client_id].push({
            id: h.id,
            action: h.action,
            date: h.date,
          });
        }

        const clients = (clientsResult.results || []).map((row: any) => {
          let parsedTags: string[] = [];
          if (row.tags) {
            try {
              parsedTags = JSON.parse(row.tags);
            } catch {
              parsedTags = row.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
            }
          }

          return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            phone: row.phone || "",
            email: row.email || "",
            empreendimento: row.empreendimento || "",
            origem: row.origem || "",
            status: row.status || "Lead Novo",
            notes: row.notes || "",
            tags: parsedTags,
            nextContactDate: row.next_contact_date || "",
            contactCount: row.contact_count || 0,
            lastContactDate: row.last_contact_date || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            comments: commentsByClient[row.id] || [],
            history: historyByClient[row.id] || [],
          };
        });

        const tasks = (tasksResult.results || []).map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          clientId: row.client_id,
          clientName: row.client_name || "",
          actionType: row.action_type,
          dueDate: row.due_date,
          dueTime: row.due_time || "",
          priority: row.priority || "Média",
          completed: Boolean(row.completed),
          notes: row.notes || "",
          createdAt: row.created_at,
        }));

        const sales = (salesResult.results || []).map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          clientId: row.client_id,
          clientName: row.client_name,
          propertyName: row.property_name || "",
          saleDate: row.sale_date,
          vgv: row.vgv || 0,
          commissionRate: row.commission_rate || 0,
          commissionValue: row.commission_value || 0,
          paymentStatus: row.payment_status || "Recebido",
          notes: row.notes || "",
        }));

        const tags = (tagsResult.results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          color: row.color,
        }));

        return jsonResponse({
          success: true,
          data: { clients, tasks, sales, tags },
          syncedAt: new Date().toISOString(),
        }, 200, corsHeaders);
      }

      if (method === "POST") {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse("Formato JSON inválido.", 400, corsHeaders);
        }

        const { clients, tasks, sales, tags } = body || {};

        if (!env.DB) {
          return jsonResponse({
            success: true,
            isOfflineMode: true,
            message: "D1 não vinculado diretamente. Dados preservados localmente.",
            syncedCount: {
              clients: clients?.length || 0,
              tasks: tasks?.length || 0,
              sales: sales?.length || 0,
            },
          }, 200, corsHeaders);
        }

        const effectiveUserId = userId || "default_broker";
        const statements: any[] = [];

        if (Array.isArray(clients)) {
          for (const client of clients) {
            const tagsJson = JSON.stringify(client.tags || []);
            statements.push(
              env.DB.prepare(`
                INSERT INTO clients (id, user_id, name, phone, email, empreendimento, origem, status, notes, tags, next_contact_date, contact_count, last_contact_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  user_id = excluded.user_id,
                  name = excluded.name,
                  phone = excluded.phone,
                  email = excluded.email,
                  empreendimento = excluded.empreendimento,
                  origem = excluded.origem,
                  status = excluded.status,
                  notes = excluded.notes,
                  tags = excluded.tags,
                  next_contact_date = excluded.next_contact_date,
                  contact_count = excluded.contact_count,
                  last_contact_date = excluded.last_contact_date,
                  updated_at = excluded.updated_at
              `).bind(
                client.id,
                client.userId || effectiveUserId,
                client.name,
                client.phone || null,
                client.email || null,
                client.empreendimento || null,
                client.origem || null,
                client.status || "Lead Novo",
                client.notes || null,
                tagsJson,
                client.nextContactDate || null,
                client.contactCount || 0,
                client.lastContactDate || null,
                client.createdAt || new Date().toISOString(),
                new Date().toISOString()
              )
            );

            if (Array.isArray(client.comments)) {
              for (const comment of client.comments) {
                statements.push(
                  env.DB.prepare(`
                    INSERT INTO client_comments (id, client_id, text, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET text = excluded.text
                  `).bind(
                    comment.id,
                    client.id,
                    comment.text,
                    comment.createdAt || new Date().toISOString()
                  )
                );
              }
            }

            if (Array.isArray(client.history)) {
              for (const hist of client.history) {
                statements.push(
                  env.DB.prepare(`
                    INSERT INTO client_history (id, client_id, action, date)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET action = excluded.action, date = excluded.date
                  `).bind(
                    hist.id,
                    client.id,
                    hist.action,
                    hist.date || new Date().toISOString()
                  )
                );
              }
            }
          }
        }

        if (Array.isArray(tasks)) {
          for (const task of tasks) {
            statements.push(
              env.DB.prepare(`
                INSERT INTO tasks (id, user_id, client_id, client_name, action_type, due_date, due_time, priority, completed, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  user_id = excluded.user_id,
                  client_id = excluded.client_id,
                  client_name = excluded.client_name,
                  action_type = excluded.action_type,
                  due_date = excluded.due_date,
                  due_time = excluded.due_time,
                  priority = excluded.priority,
                  completed = excluded.completed,
                  notes = excluded.notes
              `).bind(
                task.id,
                task.userId || effectiveUserId,
                task.clientId || null,
                task.clientName || null,
                task.actionType,
                task.dueDate,
                task.dueTime || null,
                task.priority || "Média",
                task.completed ? 1 : 0,
                task.notes || null,
                task.createdAt || new Date().toISOString()
              )
            );
          }
        }

        if (Array.isArray(sales)) {
          for (const sale of sales) {
            statements.push(
              env.DB.prepare(`
                INSERT INTO sales (id, user_id, client_id, client_name, property_name, sale_date, vgv, commission_rate, commission_value, payment_status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  user_id = excluded.user_id,
                  client_id = excluded.client_id,
                  client_name = excluded.client_name,
                  property_name = excluded.property_name,
                  sale_date = excluded.sale_date,
                  vgv = excluded.vgv,
                  commission_rate = excluded.commission_rate,
                  commission_value = excluded.commission_value,
                  payment_status = excluded.payment_status,
                  notes = excluded.notes
              `).bind(
                sale.id,
                sale.userId || effectiveUserId,
                sale.clientId || null,
                sale.clientName,
                sale.propertyName || null,
                sale.saleDate,
                sale.vgv || 0,
                sale.commissionRate || 0,
                sale.commissionValue || 0,
                sale.paymentStatus || "Recebido",
                sale.notes || null
              )
            );
          }
        }

        if (Array.isArray(tags)) {
          for (const tag of tags) {
            statements.push(
              env.DB.prepare(`
                INSERT INTO tags (id, name, color)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color
              `).bind(tag.id, tag.name, tag.color)
            );
          }
        }

        if (statements.length > 0) {
          const CHUNK_SIZE = 50;
          for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
            const chunk = statements.slice(i, i + CHUNK_SIZE);
            await env.DB.batch(chunk);
          }
        }

        return jsonResponse({
          success: true,
          syncedAt: new Date().toISOString(),
          syncedCount: {
            clients: clients?.length || 0,
            tasks: tasks?.length || 0,
            sales: sales?.length || 0,
            tags: tags?.length || 0,
          },
        }, 200, corsHeaders);
      }
    }

    // -------------------------------------------------------------
    // 9. Gemini AI: POST /api/gemini/generate-message
    // -------------------------------------------------------------
    if (pathname === "/api/gemini/generate-message") {
      if (method !== "POST") return errorResponse("Método não permitido", 405, corsHeaders);
      const apiKey = env.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
      if (!apiKey) return errorResponse("GEMINI_API_KEY não configurada.", 500, corsHeaders);

      const body: any = await request.json().catch(() => ({}));
      const { client, prompt, brokerLearnedProfile } = body || {};

      const systemPrompt = `Você é o Merlin CRM AI, especialista em comunicação persuasiva para corretores imobiliários de alto padrão.
Gere mensagens naturais, empáticas e profissionais em Português do Brasil para WhatsApp. Retorne apenas o texto da mensagem sem aspas.`;
      
      const userPrompt = `Cliente: ${JSON.stringify(client || {})}
Contexto: ${prompt || "Gerar mensagem de acompanhamento"}
Perfil do Corretor: ${JSON.stringify(brokerLearnedProfile || {})}`;

      const generated = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.7);
      return jsonResponse({ message: generated }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 10. Gemini AI: POST /api/gemini/analyze-leads
    // -------------------------------------------------------------
    if (pathname === "/api/gemini/analyze-leads") {
      if (method !== "POST") return errorResponse("Método não permitido", 405, corsHeaders);
      const apiKey = env.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
      if (!apiKey) return errorResponse("GEMINI_API_KEY não configurada.", 500, corsHeaders);

      const body: any = await request.json().catch(() => ({}));
      const { clients, brokerLearnedProfile } = body || {};

      const systemPrompt = `Você é o Merlin CRM AI, um estrategista imobiliário. Analise a carteira de leads e responda exclusivamente em JSON válido contendo o array "insights" com objetos { clientId, priority, reason, suggestedAction }.`;
      const userPrompt = `Leads: ${JSON.stringify(clients || [])}
Perfil: ${JSON.stringify(brokerLearnedProfile || {})}`;

      const raw = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.4);
      let parsed = { insights: [] };
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { insights: [] };
      }
      return jsonResponse(parsed, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 11. 404 Route Not Found
    // -------------------------------------------------------------
    return errorResponse(`Rota da API não encontrada: ${pathname}`, 404, corsHeaders);

  } catch (error: any) {
    console.error("[Cloudflare Pages Catch-all API Error]:", error);
    return errorResponse(error.message || "Erro interno do servidor.", 500, corsHeaders);
  }
};
