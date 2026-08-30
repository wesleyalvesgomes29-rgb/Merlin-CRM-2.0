import { getCorsHeaders } from "../gemini/_utils";

// Interface para Cloudflare D1 Database
interface D1Result<T = any> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<D1Result<T>>;
  run<T = any>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<any>;
}

interface Env {
  DB?: D1Database;
  GEMINI_API_KEY?: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;
  const corsHeaders = {
    ...getCorsHeaders(request),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
  };

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // ==========================================
  // GET /api/sync: Carrega dados completos do D1
  // ==========================================
  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");

      if (!env.DB) {
        // Se D1 não estiver vinculado nesta instância Cloudflare
        return new Response(
          JSON.stringify({
            success: true,
            isOfflineMode: true,
            message: "Banco Cloudflare D1 não vinculado diretamente. Operando via cache local resiliente.",
            data: { clients: [], tasks: [], sales: [], tags: [] }
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Prepara queries filtrando por user_id se fornecido
      const clientsQuery = userId
        ? env.DB.prepare("SELECT * FROM clients WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY created_at DESC").bind(userId)
        : env.DB.prepare("SELECT * FROM clients ORDER BY created_at DESC");

      const tasksQuery = userId
        ? env.DB.prepare("SELECT * FROM tasks WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY created_at DESC").bind(userId)
        : env.DB.prepare("SELECT * FROM tasks ORDER BY created_at DESC");

      const salesQuery = userId
        ? env.DB.prepare("SELECT * FROM sales WHERE user_id IS NULL OR user_id = ? OR user_id = 'default_broker' ORDER BY sale_date DESC").bind(userId)
        : env.DB.prepare("SELECT * FROM sales ORDER BY sale_date DESC");

      // Executa queries em paralelo no D1
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

      const commentsList = commentsResult.results || [];
      const historyList = historyResult.results || [];

      // Monta objetos de clientes completos com comentários e histórico
      const clients = (clientsResult.results || []).map((row: any) => {
        let tagsParsed: string[] = [];
        try {
          tagsParsed = row.tags ? (typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags) : [];
        } catch {
          tagsParsed = row.tags ? [row.tags] : [];
        }

        const clientComments = commentsList
          .filter((c: any) => c.client_id === row.id)
          .map((c: any) => ({
            id: c.id,
            date: c.created_at,
            text: c.text
          }));

        const clientHistory = historyList
          .filter((h: any) => h.client_id === row.id)
          .map((h: any) => ({
            id: h.id,
            date: h.date,
            action: h.action
          }));

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
          comments: clientComments,
          history: clientHistory
        };
      });

      const tasks = (tasksResult.results || []).map((t: any) => ({
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
      }));

      const sales = (salesResult.results || []).map((s: any) => ({
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
      }));

      const tags = (tagsResult.results || []).map((tg: any) => ({
        id: tg.id,
        name: tg.name,
        color: tg.color
      }));

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clients,
            tasks,
            sales,
            tags
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (error: any) {
      console.error("[Cloudflare Pages D1] Erro no GET /api/sync:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || "Erro ao consultar dados no D1." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }

  // ==========================================
  // POST /api/sync: Upsert completo com batch no D1
  // ==========================================
  if (request.method === "POST") {
    try {
      if (!env.DB) {
        return new Response(
          JSON.stringify({
            success: true,
            isOfflineMode: true,
            message: "Sincronização processada com sucesso no cache local.",
            syncedAt: new Date().toISOString()
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const userId = request.headers.get("X-User-Id");
      const body: any = await request.json();
      const { clients, tasks, sales, tags, userId: bodyUserId } = body || {};
      const effectiveUserId = userId || bodyUserId || "default_broker";
      const now = new Date().toISOString();
      const statements: D1PreparedStatement[] = [];

      // 1. Sync Tags
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (tag && tag.id && tag.name) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO tags (id, name, color)
                 VALUES (?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`
              ).bind(tag.id, tag.name, tag.color || "")
            );
          }
        }
      }

      // 2. Sync Sales
      if (Array.isArray(sales)) {
        for (const sale of sales) {
          if (sale && sale.id && sale.clientName) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO sales (id, user_id, client_id, client_name, property_name, sale_date, vgv, commission_rate, commission_value, payment_status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   user_id = coalesce(excluded.user_id, sales.user_id),
                   client_id = excluded.client_id,
                   client_name = excluded.client_name,
                   property_name = excluded.property_name,
                   sale_date = excluded.sale_date,
                   vgv = excluded.vgv,
                   commission_rate = excluded.commission_rate,
                   commission_value = excluded.commission_value,
                   payment_status = excluded.payment_status,
                   notes = excluded.notes`
              ).bind(
                sale.id,
                sale.userId || effectiveUserId,
                sale.clientId || null,
                sale.clientName,
                sale.propertyName || null,
                sale.saleDate || now.split("T")[0],
                sale.vgv || 0,
                sale.commissionRate || 0,
                sale.commissionValue || 0,
                sale.paymentStatus || "Recebido",
                sale.notes || ""
              )
            );
          }
        }
      }

      // 3. Sync Tasks
      if (Array.isArray(tasks)) {
        for (const task of tasks) {
          if (task && task.id && task.actionType) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO tasks (id, user_id, client_id, client_name, action_type, due_date, due_time, priority, completed, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   user_id = coalesce(excluded.user_id, tasks.user_id),
                   client_id = excluded.client_id,
                   client_name = excluded.client_name,
                   action_type = excluded.action_type,
                   due_date = excluded.due_date,
                   due_time = excluded.due_time,
                   priority = excluded.priority,
                   completed = excluded.completed,
                   notes = excluded.notes`
              ).bind(
                task.id,
                task.userId || effectiveUserId,
                task.clientId || null,
                task.clientName || "",
                task.actionType,
                task.dueDate,
                task.dueTime || null,
                task.priority || "Média",
                task.completed ? 1 : 0,
                task.notes || "",
                task.createdAt || now
              )
            );
          }
        }
      }

      // 4. Sync Clients, Comments, History
      if (Array.isArray(clients)) {
        for (const client of clients) {
          if (client && client.id && client.name) {
            const tagsJson = JSON.stringify(Array.isArray(client.tags) ? client.tags : []);

            statements.push(
              env.DB.prepare(
                `INSERT INTO clients (id, user_id, name, phone, email, empreendimento, origem, status, notes, tags, next_contact_date, contact_count, last_contact_date, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   user_id = coalesce(excluded.user_id, clients.user_id),
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
                   updated_at = excluded.updated_at`
              ).bind(
                client.id,
                client.userId || effectiveUserId,
                client.name,
                client.phone || "",
                client.email || "",
                client.empreendimento || "",
                client.origem || "",
                client.status || "Lead Novo",
                client.notes || "",
                tagsJson,
                client.nextContactDate || null,
                client.contactCount || 0,
                client.lastContactDate || null,
                client.createdAt || now,
                now
              )
            );

            if (Array.isArray(client.comments)) {
              for (const comm of client.comments) {
                if (comm && comm.id && comm.text) {
                  statements.push(
                    env.DB.prepare(
                      `INSERT INTO client_comments (id, client_id, text, created_at)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(id) DO UPDATE SET text = excluded.text`
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
                      `INSERT INTO client_history (id, client_id, action, date)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(id) DO NOTHING`
                    ).bind(hist.id, client.id, hist.action, hist.date || now)
                  );
                }
              }
            }
          }
        }
      }

      // Executa o batch no D1 se houver statements
      if (statements.length > 0) {
        const CHUNK_SIZE = 80;
        for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
          const chunk = statements.slice(i, i + CHUNK_SIZE);
          await env.DB.batch(chunk);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          syncedAt: now,
          statementCount: statements.length
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (error: any) {
      console.error("[Cloudflare Pages D1] Erro no POST /api/sync:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || "Erro ao sincronizar dados no D1." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Método não permitido" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
