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
    // 4.1 Google OAuth: GET /api/auth/google/url
    // -------------------------------------------------------------
    if (pathname === "/api/auth/google/url") {
      if (method !== "GET") return errorResponse("Método não permitido.", 405, corsHeaders);

      const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
      const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.protocol}//${url.host}/api/auth/google/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid"
      ].join(" ");
      const state = url.searchParams.get("userId") || request.headers.get("X-User-Id") || "default";

      if (!clientId) {
        const mockAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=${encodeURIComponent(scopes)}&prompt=consent&access_type=offline&state=${encodeURIComponent(state)}`;
        return jsonResponse({
          success: false,
          url: mockAuthUrl,
          redirectUri,
          scopes,
          isConfigured: false,
          clientIdPresent: false,
          error: "Google Client ID não configurado no backend (GOOGLE_CLIENT_ID ausente).",
          instructions: `Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente. Redirect URI: ${redirectUri}`
        }, 200, corsHeaders);
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

      return jsonResponse({
        success: true,
        url: authUrl,
        redirectUri,
        scopes,
        isConfigured: true,
        clientIdPresent: true
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4.2 Google OAuth: GET /api/auth/google/status
    // -------------------------------------------------------------
    if (pathname === "/api/auth/google/status") {
      if (method !== "GET") return errorResponse("Método não permitido.", 405, corsHeaders);

      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      if (!userId) {
        return jsonResponse({ success: false, isConnected: false, error: "Não autenticado." }, 401, corsHeaders);
      }

      if (env.DB) {
        try {
          const user = await env.DB.prepare(
            "SELECT google_access_token, google_refresh_token, google_token_expiry, google_email, google_connected_at FROM users WHERE id = ?"
          ).bind(userId).first<any>();

          if (user && user.google_access_token) {
            return jsonResponse({
              success: true,
              isConnected: true,
              googleEmail: user.google_email || "Conta Google Conectada",
              connectedAt: user.google_connected_at,
              isExpired: user.google_token_expiry ? Date.now() > user.google_token_expiry : false
            }, 200, corsHeaders);
          }
        } catch (dbErr) {
          console.warn("[Pages Google Auth] Colunas google não acessíveis no D1:", dbErr);
        }
      }

      return jsonResponse({
        success: true,
        isConnected: false,
        googleEmail: null
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4.3 Google OAuth: GET & POST /api/auth/google/callback
    // -------------------------------------------------------------
    if (pathname === "/api/auth/google/callback") {
      if (method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") || "default";
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (errorParam) {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <body style="background:#0B0B0B;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
              <h2 style="color:#F43F5E;">Falha na Autorização</h2>
              <p style="color:#888;">${errorParam} (${errorDesc || "Cancelado"})</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${errorParam}' }, '*');
                }
                setTimeout(() => { try { window.close(); } catch(e){} }, 4000);
              </script>
            </body>
            </html>
          `, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
        }

        if (!code) {
          return new Response("Código de autorização não fornecido pelo Google.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
        }

        const userId = state && state !== "default" ? state : "default";
        const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET;
        const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.protocol}//${url.host}/api/auth/google/callback`;

        let accessToken = "";
        let refreshToken = "";
        let expiresIn = 3600;
        let googleEmail = "";

        if (clientId && clientSecret) {
          try {
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code"
              })
            });

            if (tokenRes.ok) {
              const tokenData: any = await tokenRes.json();
              accessToken = tokenData.access_token;
              refreshToken = tokenData.refresh_token || "";
              expiresIn = tokenData.expires_in || 3600;

              if (accessToken) {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (userRes.ok) {
                  const userData: any = await userRes.json();
                  googleEmail = userData.email || "";
                }
              }
            }
          } catch (e) {
            console.error("[Pages Google Auth] Erro ao trocar token:", e);
          }
        } else {
          accessToken = `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          googleEmail = "corretor@google.com";
        }

        const now = new Date().toISOString();
        const expiryTime = Date.now() + (expiresIn * 1000);

        if (env.DB && userId && userId !== "default") {
          try {
            await env.DB.prepare(
              "UPDATE users SET google_access_token = ?, google_refresh_token = ?, google_token_expiry = ?, google_email = ?, google_connected_at = ? WHERE id = ?"
            ).bind(accessToken, refreshToken || null, expiryTime, googleEmail, now, userId).run();
          } catch (dbErr) {
            console.warn("[Pages Google Auth] Falha ao persistir tokens no D1:", dbErr);
          }
        }

        return new Response(`
          <!DOCTYPE html>
          <html>
          <body style="background:#0B0B0B;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
            <h2 style="color:#34D399;">Conectado com Sucesso!</h2>
            <p style="color:#888;">Conta: ${googleEmail}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_AUTH_SUCCESS',
                  accessToken: '${accessToken}',
                  googleEmail: '${googleEmail}',
                  expiresIn: ${expiresIn}
                }, '*');
              }
              setTimeout(() => { try { window.close(); } catch(e){} }, 1500);
            </script>
          </body>
          </html>
        `, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
      }

      if (method === "POST") {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse("Formato JSON inválido.", 400, corsHeaders);
        }

        const { code, accessToken, refreshToken, expiresIn, googleEmail, userId: bodyUserId } = body || {};
        const userId = request.headers.get("X-User-Id") || bodyUserId;

        if (!userId) {
          return errorResponse("Identificação do usuário (userId) necessária.", 401, corsHeaders);
        }

        let finalAccessToken = accessToken;
        let finalRefreshToken = refreshToken;
        let finalExpiresIn = expiresIn || 3600;
        let finalEmail = googleEmail;

        if (code) {
          const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET;
          const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.protocol}//${url.host}/api/auth/google/callback`;

          if (!clientId || !clientSecret) {
            return errorResponse("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no servidor.", 400, corsHeaders);
          }

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code"
            })
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            return errorResponse(`Erro retornado pelo Google (${tokenRes.status}): ${errText}`, tokenRes.status, corsHeaders);
          }

          const tokenData: any = await tokenRes.json();
          finalAccessToken = tokenData.access_token;
          finalRefreshToken = tokenData.refresh_token || finalRefreshToken;
          finalExpiresIn = tokenData.expires_in || 3600;
        }

        if (finalAccessToken && !finalEmail) {
          try {
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${finalAccessToken}` }
            });
            if (userInfoRes.ok) {
              const userInfo: any = await userInfoRes.json();
              finalEmail = userInfo.email;
            }
          } catch (userErr) {
            console.warn("[Pages Google Auth] Erro ao buscar userinfo:", userErr);
          }
        }

        if (!finalAccessToken) {
          return errorResponse("Access token ou authorization code ausente ou inválido.", 400, corsHeaders);
        }

        const now = new Date().toISOString();
        const expiryTime = Date.now() + (finalExpiresIn * 1000);

        if (env.DB) {
          try {
            await env.DB.prepare(
              "UPDATE users SET google_access_token = ?, google_refresh_token = ?, google_token_expiry = ?, google_email = ?, google_connected_at = ? WHERE id = ?"
            ).bind(finalAccessToken, finalRefreshToken || null, expiryTime, finalEmail || null, now, userId).run();
          } catch (dbErr: any) {
            console.warn("[Pages Google Auth] Erro ao salvar tokens no D1:", dbErr);
          }
        }

        return jsonResponse({
          success: true,
          message: "Conta Google conectada com sucesso!",
          googleEmail: finalEmail,
          connectedAt: now
        }, 200, corsHeaders);
      }
    }

    // -------------------------------------------------------------
    // 4.4 Google OAuth: POST /api/auth/google/disconnect
    // -------------------------------------------------------------
    if (pathname === "/api/auth/google/disconnect") {
      if (method !== "POST") return errorResponse("Método não permitido.", 405, corsHeaders);

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const userId = request.headers.get("X-User-Id") || body?.userId;
      if (!userId) return errorResponse("Não autenticado.", 401, corsHeaders);

      if (env.DB) {
        try {
          await env.DB.prepare(
            "UPDATE users SET google_access_token = NULL, google_refresh_token = NULL, google_token_expiry = NULL, google_email = NULL, google_connected_at = NULL WHERE id = ?"
          ).bind(userId).run();
        } catch (dbErr: any) {
          console.warn("[Pages Google Auth] Erro ao desconectar no D1:", dbErr);
        }
      }

      return jsonResponse({ success: true, message: "Google Agenda desconectado com sucesso." }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4.5 Google Calendar: POST /api/calendar/create-event
    // -------------------------------------------------------------
    if (pathname === "/api/calendar/create-event") {
      if (method !== "POST") return errorResponse("Método não permitido.", 405, corsHeaders);

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return errorResponse("Formato JSON inválido.", 400, corsHeaders);
      }

      const { title, dueDate, dueTime, notes, clientName, priority, location, clientPhone, userId: bodyUserId } = body || {};
      const userId = request.headers.get("X-User-Id") || bodyUserId;

      let token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

      if (userId && env.DB && !token) {
        try {
          const u = await env.DB.prepare(
            "SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = ?"
          ).bind(userId).first<any>();
          if (u && u.google_access_token) {
            token = u.google_access_token;
          }
        } catch (dbErr) {
          console.warn("[Pages Google Calendar] Erro ao consultar tokens:", dbErr);
        }
      }

      if (!token) {
        return jsonResponse({
          success: false,
          error: "Conta Google não conectada. Conecte no perfil para sincronização automática.",
          needsAuth: true
        }, 401, corsHeaders);
      }

      if (!title || !dueDate) {
        return errorResponse("Título e Data de vencimento (dueDate) são obrigatórios para agendamento.", 400, corsHeaders);
      }

      let startObj: any = {};
      let endObj: any = {};

      if (dueTime && dueTime.includes(":")) {
        const [hStr, minStr] = dueTime.split(":");
        const hours = parseInt(hStr, 10) || 0;
        const minutes = parseInt(minStr, 10) || 0;

        const [yStr, mStr, dStr] = dueDate.split("-");
        const startDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10), hours, minutes, 0);
        const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

        startObj = { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" };
        endObj = { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" };
      } else {
        startObj = { date: dueDate };
        const [yStr, mStr, dStr] = dueDate.split("-");
        const nextDay = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10) + 1);
        const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        endObj = { date: nextDayStr };
      }

      const descriptionParts: string[] = [];
      if (notes) descriptionParts.push(`📝 Detalhes: ${notes}`);
      if (clientName) descriptionParts.push(`👤 Lead: ${clientName}`);
      if (clientPhone) descriptionParts.push(`📞 Telefone/Whats: ${clientPhone}`);
      if (priority) descriptionParts.push(`⚡ Prioridade: ${priority}`);
      descriptionParts.push(`\nAgendado automaticamente pelo Merlin CRM ⚡`);

      const calendarEventPayload = {
        summary: title,
        description: descriptionParts.join("\n"),
        location: location || "",
        start: startObj,
        end: endObj,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 10 }
          ]
        }
      };

      const googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(calendarEventPayload)
      });

      if (!googleRes.ok) {
        const errBody = await googleRes.text();
        return jsonResponse({
          success: false,
          error: `Falha ao salvar no Google Calendar (${googleRes.status}).`,
          details: errBody
        }, googleRes.status, corsHeaders);
      }

      const eventData: any = await googleRes.json();
      return jsonResponse({
        success: true,
        message: "Evento criado com sucesso no Google Agenda!",
        eventId: eventData.id,
        htmlLink: eventData.htmlLink,
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end,
        createdSilently: true
      }, 201, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4.6 Tasks & Routine: GET /api/tasks/my-day
    // -------------------------------------------------------------
    if (pathname === "/api/tasks/my-day") {
      if (method !== "GET") return errorResponse("Método não permitido.", 405, corsHeaders);

      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      const todayDate = new Date();
      const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      if (!env.DB) {
        return jsonResponse({
          success: true,
          todayStr,
          stats: { totalPending: 0, overdueCount: 0, todayCount: 0, upcomingCount: 0, completedCount: 0, staleClientsCount: 0 },
          overdue: [],
          today: [],
          upcoming: [],
          completed: [],
          staleClients: []
        }, 200, corsHeaders);
      }

      try {
        let taskQuery = "SELECT t.*, c.name as clientName, c.phone as clientPhone, c.status as clientStatus, c.empreendimento as clientEmpreendimento FROM tasks t LEFT JOIN clients c ON t.client_id = c.id";
        let taskParams: any[] = [];
        if (userId) {
          taskQuery += " WHERE t.user_id = ? OR t.user_id IS NULL OR t.user_id = 'default_broker'";
          taskParams.push(userId);
        }
        taskQuery += " ORDER BY t.due_date ASC, t.due_time ASC";

        const tasksResult = await env.DB.prepare(taskQuery).bind(...taskParams).all();
        const allTasks = (tasksResult.results || []).map((t: any) => ({
          id: t.id,
          clientId: t.client_id,
          clientName: t.clientName || t.client_name,
          clientPhone: t.clientPhone || t.client_phone,
          clientStatus: t.clientStatus || t.client_status,
          clientEmpreendimento: t.clientEmpreendimento || t.client_empreendimento,
          actionType: t.action_type || t.actionType || 'Outro',
          dueDate: t.due_date || t.dueDate,
          dueTime: t.due_time || t.dueTime,
          priority: t.priority || 'Média',
          notes: t.notes || '',
          completed: Boolean(t.completed),
          googleCalendarEventId: t.google_calendar_event_id || t.google_event_id,
          createdAt: t.created_at
        }));

        const overdue: any[] = [];
        const today: any[] = [];
        const upcoming: any[] = [];
        const completed: any[] = [];

        for (const task of allTasks) {
          if (task.completed) {
            completed.push(task);
            continue;
          }
          if (task.dueDate < todayStr) {
            overdue.push(task);
          } else if (task.dueDate === todayStr) {
            today.push(task);
          } else {
            upcoming.push(task);
          }
        }

        let clientQuery = "SELECT id, name, phone, status, empreendimento, last_contact_date, created_at FROM clients WHERE status NOT IN ('Venda Fechada', 'Perdido')";
        let clientParams: any[] = [];
        if (userId) {
          clientQuery += " AND (user_id = ? OR user_id IS NULL OR user_id = 'default_broker')";
          clientParams.push(userId);
        }
        const clientsResult = await env.DB.prepare(clientQuery).bind(...clientParams).all();
        const staleClients: any[] = [];
        const nowMs = Date.now();

        for (const c of (clientsResult.results || []) as any[]) {
          const contactStr = c.last_contact_date || c.created_at;
          if (contactStr) {
            const contactMs = new Date(contactStr).getTime();
            if (!isNaN(contactMs)) {
              const diffDays = Math.floor((nowMs - contactMs) / (1000 * 60 * 60 * 24));
              if (diffDays > 15) {
                staleClients.push({
                  id: c.id,
                  name: c.name,
                  phone: c.phone,
                  status: c.status,
                  empreendimento: c.empreendimento,
                  daysWithoutContact: diffDays,
                  lastContactDate: c.last_contact_date,
                  createdAt: c.created_at
                });
              }
            }
          }
        }

        staleClients.sort((a, b) => b.daysWithoutContact - a.daysWithoutContact);

        return jsonResponse({
          success: true,
          todayStr,
          stats: {
            totalPending: overdue.length + today.length + upcoming.length,
            overdueCount: overdue.length,
            todayCount: today.length,
            upcomingCount: upcoming.length,
            completedCount: completed.length,
            staleClientsCount: staleClients.length
          },
          overdue,
          today,
          upcoming,
          completed,
          staleClients
        }, 200, corsHeaders);
      } catch (err: any) {
        return errorResponse(err.message || "Erro ao consultar tarefas.", 500, corsHeaders);
      }
    }

    // -------------------------------------------------------------
    // 4.7 Tasks & Routine: PATCH/POST /api/tasks/:id/complete
    // -------------------------------------------------------------
    if (pathname.startsWith("/api/tasks/") && pathname.endsWith("/complete")) {
      if (method !== "PATCH" && method !== "POST") return errorResponse("Método não permitido.", 405, corsHeaders);

      const taskId = pathname.split("/")[3];
      if (!taskId) return errorResponse("ID da tarefa é obrigatório.", 400, corsHeaders);

      const now = new Date().toISOString();

      if (env.DB) {
        try {
          const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<any>();
          if (!task) {
            return errorResponse("Tarefa não encontrada.", 404, corsHeaders);
          }

          await env.DB.prepare("UPDATE tasks SET completed = 1, updated_at = ? WHERE id = ?").bind(now, taskId).run();

          if (task.client_id) {
            const histId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const actionText = `Tarefa concluída: "${task.action_type || 'Ação'} - ${task.notes || 'Sem observações'}"`;
            await env.DB.prepare("INSERT INTO client_history (id, client_id, action, date) VALUES (?, ?, ?, ?)").bind(histId, task.client_id, actionText, now).run().catch(() => {});
          }

          return jsonResponse({
            success: true,
            message: "Tarefa concluída com sucesso.",
            taskId
          }, 200, corsHeaders);
        } catch (err: any) {
          return errorResponse(err.message || "Erro ao concluir tarefa.", 500, corsHeaders);
        }
      }

      return jsonResponse({ success: true, message: "Tarefa concluída com sucesso.", taskId }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // 4.8 Tasks & Routine: PATCH/POST /api/tasks/:id/reschedule
    // -------------------------------------------------------------
    if (pathname.startsWith("/api/tasks/") && pathname.endsWith("/reschedule")) {
      if (method !== "PATCH" && method !== "POST") return errorResponse("Método não permitido.", 405, corsHeaders);

      const taskId = pathname.split("/")[3];
      if (!taskId) return errorResponse("ID da tarefa é obrigatório.", 400, corsHeaders);

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return errorResponse("Formato JSON inválido.", 400, corsHeaders);
      }

      const { dueDate, dueTime } = body || {};
      if (!dueDate) return errorResponse("dueDate é obrigatório.", 400, corsHeaders);

      const now = new Date().toISOString();

      if (env.DB) {
        try {
          await env.DB.prepare("UPDATE tasks SET due_date = ?, due_time = ?, completed = 0, updated_at = ? WHERE id = ?").bind(dueDate, dueTime || null, now, taskId).run();
          return jsonResponse({ success: true, message: "Tarefa reagendada com sucesso." }, 200, corsHeaders);
        } catch (err: any) {
          return errorResponse(err.message || "Erro ao reagendar tarefa.", 500, corsHeaders);
        }
      }

      return jsonResponse({ success: true, message: "Tarefa reagendada com sucesso." }, 200, corsHeaders);
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
