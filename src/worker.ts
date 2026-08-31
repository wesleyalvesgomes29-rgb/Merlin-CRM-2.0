import { buildPlaybookSystemPrompt, getPlaybookFallbackOptions, PlaybookPillarId } from "./lib/salesPlaybook";

export interface Env {
  GEMINI_API_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  DB?: any;
  ASSETS?: any;
}

export const MASTER_INVITE_CODE = "MERLIN-ADMIN-2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
};

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

// Helper para obter a redirect URI dinâmica baseada no host da requisição
export function getDynamicRedirectUri(request: Request, env: Env): string {
  if (env.GOOGLE_REDIRECT_URI && env.GOOGLE_REDIRECT_URI.trim()) {
    return env.GOOGLE_REDIRECT_URI.trim();
  }
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

// Helper para renovar o access token do Google no Cloudflare Worker
export async function refreshGoogleAccessTokenWorker(userId: string, refreshToken: string, env: Env): Promise<string | null> {
  const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (res.ok) {
      const data: any = await res.json();
      const newAccessToken = data.access_token;
      const expiresIn = data.expires_in || 3600;
      const expiryTime = Date.now() + (expiresIn * 1000);
      if (env.DB && userId) {
        try {
          await env.DB.prepare("UPDATE users SET google_access_token = ?, google_token_expiry = ? WHERE id = ?")
            .bind(newAccessToken, expiryTime, userId)
            .run();
        } catch (dbErr) {
          console.warn("[Worker Google Auth] Falha ao atualizar token renovado no D1:", dbErr);
        }
      }
      return newAccessToken;
    } else {
      const err = await res.text();
      console.warn("[Worker Google Auth] Falha ao renovar token:", res.status, err);
      return null;
    }
  } catch (err) {
    console.error("[Worker Google Auth] Erro ao conectar com oauth2.googleapis.com:", err);
    return null;
  }
}

export function generateRandomSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 10000,
      hash: "SHA-512"
    },
    baseKey,
    512
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomInviteCode(prefix = "MERLIN"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${part1}-${part2}`;
}

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
    if (path === "/api/health" || path === "/api") {
      return jsonResponse({
        status: "ok",
        service: "Merlin CRM Backend",
        d1Configured: !!env.DB,
        timestamp: new Date().toISOString(),
      });
    }

    // ==========================================
    // ROTAS DE AUTENTICAÇÃO
    // ==========================================

    // POST /api/auth/register: Cadastro com código de convite
    if (path === "/api/auth/register") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
      }

      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse("Formato JSON inválido no corpo da requisição.", 400);
        }

        const { name, email, password, inviteCode } = body || {};

        if (!name || !name.trim()) {
          return errorResponse("O nome completo é obrigatório.", 400);
        }
        if (!email || !email.trim() || !email.includes("@")) {
          return errorResponse("Informe um endereço de e-mail válido.", 400);
        }
        if (!password || password.length < 6) {
          return errorResponse("A senha deve ter no mínimo 6 caracteres.", 400);
        }
        if (!inviteCode || !inviteCode.trim()) {
          return errorResponse("O Código de Convite é obrigatório para cadastro.", 400);
        }

        const emailNorm = email.trim().toLowerCase();
        const codeNorm = inviteCode.trim().toUpperCase();
        const isMaster = codeNorm === MASTER_INVITE_CODE;
        const role = isMaster ? "admin" : "broker";

        if (!env.DB) {
          // Fallback resiliente se o D1 não estiver configurado
          return jsonResponse({
            success: true,
            user: {
              id: "usr_" + Math.random().toString(36).substring(2, 9),
              name: name.trim(),
              email: emailNorm,
              role,
              createdAt: new Date().toISOString(),
            },
          }, 201);
        }

        // 1. Verifica se usuário já existe
        const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(emailNorm).first();
        if (existingUser) {
          return errorResponse("Este e-mail já está cadastrado no sistema.", 400);
        }

        // 2. Valida código de convite
        if (!isMaster) {
          const invite = await env.DB.prepare("SELECT * FROM invite_codes WHERE code = ?").bind(codeNorm).first();
          if (!invite || invite.is_active !== 1 || invite.used_by) {
            return errorResponse("Código de convite inválido ou expirado", 403);
          }
        }

        // 3. Cria hash de senha com Web Crypto API (crypto.subtle)
        const userId = "usr_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        const salt = generateRandomSalt();
        const passwordHash = await hashPasswordWithSalt(password, salt);
        const now = new Date().toISOString();

        await env.DB.prepare(
          "INSERT INTO users (id, name, email, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(userId, name.trim(), emailNorm, passwordHash, salt, role, now).run();

        // 4. Marca convite como usado se não for master
        if (!isMaster) {
          await env.DB.prepare(
            "UPDATE invite_codes SET is_active = 0, used_by = ?, used_at = ? WHERE code = ?"
          ).bind(userId, now, codeNorm).run();
        }

        return jsonResponse({
          success: true,
          message: "Usuário cadastrado com sucesso!",
          user: {
            id: userId,
            name: name.trim(),
            email: emailNorm,
            role,
            createdAt: now,
          },
        }, 201);
      } catch (error: any) {
        console.error("[Cloudflare Worker Auth] Erro no registro:", error);
        return errorResponse(error.message || "Erro interno ao registrar usuário.", 500);
      }
    }

    // POST /api/auth/login: Autenticação por e-mail e senha
    if (path === "/api/auth/login") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
      }

      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse("Formato JSON inválido no corpo da requisição.", 400);
        }

        const { email, password } = body || {};
        if (!email || !password) {
          return errorResponse("E-mail e senha são obrigatórios.", 400);
        }

        const emailNorm = email.trim().toLowerCase();

        if (!env.DB) {
          return jsonResponse({
            success: true,
            user: {
              id: "usr_default",
              name: emailNorm.split("@")[0],
              email: emailNorm,
              role: "admin",
              createdAt: new Date().toISOString(),
            },
          }, 200);
        }

        const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(emailNorm).first();
        if (!user) {
          return errorResponse("E-mail ou senha incorretos.", 401);
        }

        const computedHash = await hashPasswordWithSalt(password, user.salt);
        if (computedHash !== user.password_hash) {
          return errorResponse("E-mail ou senha incorretos.", 401);
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
        }, 200);
      } catch (error: any) {
        console.error("[Cloudflare Worker Auth] Erro no login:", error);
        return errorResponse(error.message || "Erro interno ao realizar login.", 500);
      }
    }

    // GET /api/auth/me: Validação de sessão do usuário
    if (path === "/api/auth/me") {
      if (request.method !== "GET") {
        return errorResponse("Método não permitido.", 405);
      }

      const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      if (!userId) {
        return errorResponse("Não autenticado.", 401);
      }

      if (!env.DB) {
        return jsonResponse({
          success: true,
          user: {
            id: userId,
            name: "Corretor Merlin",
            email: "corretor@merlin.crm",
            role: "admin",
            createdAt: new Date().toISOString(),
          },
        });
      }

      const user = await env.DB.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").bind(userId).first();
      if (!user) {
        return errorResponse("Usuário não encontrado.", 404);
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
      });
    }

    // ==========================================
    // ROTAS GOOGLE OAUTH2 & GOOGLE CALENDAR
    // ==========================================

    // GET /api/auth/google/url: Retorna URL de consentimento do Google OAuth2
    if (path === "/api/auth/google/url") {
      try {
        const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
        const redirectUri = getDynamicRedirectUri(request, env);
        const scopes = [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "openid"
        ].join(" ");

        const state = url.searchParams.get("userId") || request.headers.get("X-User-Id") || "default";

        console.log("[Worker Google Auth URL] Gerando URL de autorização:", {
          clientIdConfigured: !!clientId,
          redirectUri,
          state
        });

        if (!clientId) {
          const mockAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=${encodeURIComponent(scopes)}&prompt=consent&access_type=offline&state=${encodeURIComponent(state)}`;
          return jsonResponse({
            success: false,
            url: mockAuthUrl,
            redirectUri,
            scopes,
            isConfigured: false,
            clientIdPresent: false,
            error: "Google Client ID não configurado no backend (GOOGLE_CLIENT_ID ausente no Cloudflare Worker).",
            instructions: `Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis do Worker. Redirect URI: ${redirectUri}`
          });
        }

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

        return jsonResponse({
          success: true,
          url: authUrl,
          redirectUri,
          scopes,
          isConfigured: true,
          clientIdPresent: true
        });
      } catch (error: any) {
        console.error("[Worker Google Auth] Erro ao gerar URL:", error);
        return errorResponse(error.message || "Erro ao gerar URL do Google OAuth2.", 500);
      }
    }

    // GET /api/auth/google/status: Retorna status da conexão do Google para o usuário
    if (path === "/api/auth/google/status") {
      try {
        const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
        if (!userId) {
          return jsonResponse({ success: false, isConnected: false, error: "Não autenticado." }, 401);
        }

        if (env.DB) {
          try {
            const user = await env.DB.prepare(
              "SELECT google_access_token, google_refresh_token, google_token_expiry, google_email, google_connected_at FROM users WHERE id = ?"
            ).bind(userId).first();

            if (user && user.google_access_token) {
              return jsonResponse({
                success: true,
                isConnected: true,
                googleEmail: user.google_email || "Conta Google Conectada",
                connectedAt: user.google_connected_at,
                isExpired: user.google_token_expiry ? Date.now() > user.google_token_expiry : false
              });
            }
          } catch (dbErr) {
            console.warn("[Worker Google Auth] Colunas google não acessíveis no D1:", dbErr);
          }
        }

        return jsonResponse({
          success: true,
          isConnected: false,
          googleEmail: null
        });
      } catch (error: any) {
        console.error("[Worker Google Auth] Erro no status:", error);
        return errorResponse(error.message || "Erro ao verificar status do Google.", 500);
      }
    }

    // GET & POST /api/auth/google/callback: Tratamento do retorno de autenticação
    if (path === "/api/auth/google/callback") {
      // GET: Redirecionamento da janela do Google
      if (request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") || "default";
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (errorParam) {
          return new Response(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <title>Erro de Autenticação - Merlin CRM</title>
              <style>
                body { font-family: system-ui, sans-serif; background: #0B0B0B; color: #FFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #141414; border: 1px solid #2A2A2A; border-radius: 20px; padding: 32px; max-width: 440px; text-align: center; }
                h2 { color: #F43F5E; margin: 0 0 12px; font-size: 20px; }
                p { color: #888; font-size: 14px; margin: 0 0 20px; }
                .btn { background: #262626; color: #FFF; border: none; padding: 10px 20px; border-radius: 12px; cursor: pointer; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Falha na Autorização</h2>
                <p>O Google recusou a autorização: <strong>${errorParam}</strong> (${errorDesc || "Acesso cancelado"}).</p>
                <button class="btn" onclick="window.close()">Fechar Janela</button>
              </div>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${errorParam}', errorDescription: '${errorDesc || ""}' }, '*');
                }
                setTimeout(() => { try { window.close(); } catch(e){} }, 4000);
              </script>
            </body>
            </html>
          `, {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
          });
        }

        if (!code) {
          return new Response("Código de autorização não fornecido pelo Google.", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders }
          });
        }

        const userId = state && state !== "default" ? state : "default";
        const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET;
        const redirectUri = getDynamicRedirectUri(request, env);

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

            if (!tokenRes.ok) {
              const errText = await tokenRes.text();
              return new Response(`
                <!DOCTYPE html>
                <html>
                <body style="background:#0B0B0B;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
                  <h2 style="color:#F43F5E;">Erro na Troca de Credenciais</h2>
                  <p style="color:#888;">Status ${tokenRes.status}: ${errText}</p>
                  <script>
                    if (window.opener) {
                      window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'Token exchange failed: ${tokenRes.status}' }, '*');
                    }
                  </script>
                </body>
                </html>
              `, {
                status: 400,
                headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
              });
            }

            const tokenData: any = await tokenRes.json();
            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token || "";
            expiresIn = tokenData.expires_in || 3600;

            if (accessToken) {
              try {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (userRes.ok) {
                  const userData: any = await userRes.json();
                  googleEmail = userData.email || "";
                }
              } catch (uErr) {
                console.warn("[Worker Google Auth] Erro ao buscar userinfo:", uErr);
              }
            }
          } catch (tokenErr: any) {
            console.error("[Worker Google Auth] Erro ao trocar token:", tokenErr);
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
            console.warn("[Worker Google Auth] Falha ao persistir tokens no D1:", dbErr);
          }
        }

        return new Response(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <title>Google Agenda Conectado - Merlin CRM</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #0B0B0B; color: #FFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #141414; border: 1px solid #2A2A2A; border-radius: 20px; padding: 32px; max-width: 440px; text-align: center; }
              .icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(52, 211, 153, 0.15); color: #34D399; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
              h2 { color: #34D399; margin: 0 0 12px; font-size: 20px; }
              p { color: #888; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
              .email { color: #60A5FA; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✓</div>
              <h2>Conectado com Sucesso!</h2>
              <p>Sua conta Google <span class="email">${googleEmail || ""}</span> foi conectada ao Merlin CRM. Esta janela fechará automaticamente.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_AUTH_SUCCESS',
                  accessToken: '${accessToken}',
                  googleEmail: '${googleEmail}',
                  expiresIn: ${expiresIn}
                }, '*');
              }
              setTimeout(() => {
                try { window.close(); } catch(e){}
              }, 1500);
            </script>
          </body>
          </html>
        `, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
      }

      // POST: Salva tokens via API direta
      if (request.method === "POST") {
        try {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return errorResponse("Formato JSON inválido.", 400);
          }

          const { code, accessToken, refreshToken, expiresIn, googleEmail, userId: bodyUserId } = body || {};
          const userId = request.headers.get("X-User-Id") || bodyUserId;

          if (!userId) {
            return errorResponse("Identificação do usuário (userId) necessária.", 401);
          }

          let finalAccessToken = accessToken;
          let finalRefreshToken = refreshToken;
          let finalExpiresIn = expiresIn || 3600;
          let finalEmail = googleEmail;

          if (code) {
            const clientId = env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID;
            const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET;
            const redirectUri = getDynamicRedirectUri(request, env);

            if (!clientId || !clientSecret) {
              return errorResponse("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no servidor.", 400);
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
              return errorResponse(`Erro retornado pelo Google (${tokenRes.status}): ${errText}`, tokenRes.status);
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
              console.warn("[Worker Google Auth] Erro ao buscar userinfo:", userErr);
            }
          }

          if (!finalAccessToken) {
            return errorResponse("Access token ou authorization code ausente ou inválido.", 400);
          }

          const now = new Date().toISOString();
          const expiryTime = Date.now() + (finalExpiresIn * 1000);

          if (env.DB) {
            try {
              await env.DB.prepare(
                "UPDATE users SET google_access_token = ?, google_refresh_token = ?, google_token_expiry = ?, google_email = ?, google_connected_at = ? WHERE id = ?"
              ).bind(finalAccessToken, finalRefreshToken || null, expiryTime, finalEmail || null, now, userId).run();
            } catch (dbErr: any) {
              console.warn("[Worker Google Auth] Erro ao salvar tokens no D1:", dbErr);
            }
          }

          return jsonResponse({
            success: true,
            message: "Conta Google conectada com sucesso!",
            googleEmail: finalEmail,
            connectedAt: now
          });
        } catch (error: any) {
          console.error("[Worker Google Auth Callback POST] Erro:", error);
          return errorResponse(error.message || "Erro inesperado ao conectar conta Google.", 500);
        }
      }

      return errorResponse("Método não permitido.", 405);
    }

    // POST /api/auth/google/disconnect: Desconecta a conta Google
    if (path === "/api/auth/google/disconnect") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
      }

      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const userId = request.headers.get("X-User-Id") || body?.userId;
        if (!userId) {
          return errorResponse("Não autenticado.", 401);
        }

        if (env.DB) {
          try {
            await env.DB.prepare(
              "UPDATE users SET google_access_token = NULL, google_refresh_token = NULL, google_token_expiry = NULL, google_email = NULL, google_connected_at = NULL WHERE id = ?"
            ).bind(userId).run();
          } catch (dbErr: any) {
            console.warn("[Worker Google Auth] Erro ao remover tokens no D1:", dbErr);
          }
        }

        return jsonResponse({ success: true, message: "Google Agenda desconectado com sucesso." });
      } catch (error: any) {
        return errorResponse(error.message || "Erro ao desconectar Google Agenda.", 500);
      }
    }

    // POST /api/calendar/create-event: Criação silenciosa de eventos no Google Calendar
    if (path === "/api/calendar/create-event") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
      }

      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse("Formato JSON inválido.", 400);
        }

        const { title, dueDate, dueTime, notes, clientName, priority, location, clientPhone, clientId: targetClientId, userId: bodyUserId } = body || {};
        const userId = request.headers.get("X-User-Id") || bodyUserId;

        let token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

        if (userId && env.DB) {
          try {
            const u = await env.DB.prepare(
              "SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = ?"
            ).bind(userId).first();

            if (u && u.google_access_token) {
              if (!token) {
                token = u.google_access_token;
              }

              const isExpiringSoon = u.google_token_expiry && (Date.now() > (u.google_token_expiry - 60000));
              if ((!token || isExpiringSoon) && u.google_refresh_token) {
                const refreshed = await refreshGoogleAccessTokenWorker(userId, u.google_refresh_token, env);
                if (refreshed) {
                  token = refreshed;
                }
              }
            }
          } catch (dbErr) {
            console.warn("[Worker Google Calendar] Erro ao consultar tokens do usuário no D1:", dbErr);
          }
        }

        if (!token) {
          return jsonResponse({
            success: false,
            error: "Conta Google não conectada. Conecte no perfil para sincronização automática.",
            needsAuth: true
          }, 401);
        }

        if (!title || !dueDate) {
          return errorResponse("Título e Data de vencimento (dueDate) são obrigatórios para agendamento.", 400);
        }

        let startObj: any = {};
        let endObj: any = {};

        if (dueTime && dueTime.includes(":")) {
          const [hStr, minStr] = dueTime.split(":");
          const hours = parseInt(hStr, 10) || 0;
          const minutes = parseInt(minStr, 10) || 0;

          const [yStr, mStr, dStr] = dueDate.split("-");
          const year = parseInt(yStr, 10);
          const month = parseInt(mStr, 10) - 1;
          const day = parseInt(dStr, 10);

          const startDate = new Date(year, month, day, hours, minutes, 0);
          const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

          startObj = {
            dateTime: startDate.toISOString(),
            timeZone: "America/Sao_Paulo"
          };
          endObj = {
            dateTime: endDate.toISOString(),
            timeZone: "America/Sao_Paulo"
          };
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

        let googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(calendarEventPayload)
        });

        if (googleRes.status === 401 && userId && env.DB) {
          const u = await env.DB.prepare("SELECT google_refresh_token FROM users WHERE id = ?").bind(userId).first();
          if (u && u.google_refresh_token) {
            const refreshed = await refreshGoogleAccessTokenWorker(userId, u.google_refresh_token, env);
            if (refreshed) {
              token = refreshed;
              googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(calendarEventPayload)
              });
            }
          }
        }

        if (!googleRes.ok) {
          const errBody = await googleRes.text();
          console.error("[Worker Google Calendar] Erro da Google API:", googleRes.status, errBody);
          return jsonResponse({
            success: false,
            error: `Falha ao salvar no Google Calendar (${googleRes.status}).`,
            details: errBody,
            status: googleRes.status
          }, googleRes.status);
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
        }, 201);
      } catch (error: any) {
        console.error("[Worker Google Calendar] Erro ao criar evento:", error);
        return errorResponse(error.message || "Erro inesperado ao salvar no Google Agenda.", 500);
      }
    }

    // ==========================================
    // ROTAS DE ADMINISTRAÇÃO (CONVITES)
    // ==========================================

    // POST /api/admin/create-invite: Geração de novos códigos de convite
    if (path === "/api/admin/create-invite") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
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
        return errorResponse("Acesso não autorizado.", 401);
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
        }, 201);
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first();
      if (!user || user.role !== "admin") {
        return errorResponse("Apenas administradores podem gerar códigos de convite.", 403);
      }

      const existing = await env.DB.prepare("SELECT code FROM invite_codes WHERE code = ?").bind(code).first();
      if (existing) {
        return errorResponse("Este código de convite já existe.", 400);
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
      }, 201);
    }

    // GET /api/admin/invite-codes: Listagem de convites gerados
    if (path === "/api/admin/invite-codes") {
      if (request.method !== "GET") {
        return errorResponse("Método não permitido.", 405);
      }

      const adminUserId = request.headers.get("X-User-Id") || url.searchParams.get("userId");
      if (!adminUserId) {
        return errorResponse("Acesso não autorizado.", 401);
      }

      if (!env.DB) {
        return jsonResponse({
          success: true,
          invites: [
            {
              code: MASTER_INVITE_CODE,
              created_by: "system",
              used_by: null,
              used_at: null,
              is_active: 1,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(adminUserId).first();
      if (!user || user.role !== "admin") {
        return errorResponse("Apenas administradores podem visualizar códigos de convite.", 403);
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
      });
    }

    // POST /api/admin/revoke-invite: Revogação de código de convite
    if (path === "/api/admin/revoke-invite") {
      if (request.method !== "POST") {
        return errorResponse("Método não permitido.", 405);
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
        return errorResponse("Parâmetros insuficientes.", 400);
      }

      if (!env.DB) {
        return jsonResponse({ success: true, message: "Código revogado." });
      }

      const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first();
      if (!user || user.role !== "admin") {
        return errorResponse("Acesso restrito a administradores.", 403);
      }

      const codeNorm = code.trim().toUpperCase();
      await env.DB.prepare("UPDATE invite_codes SET is_active = 0 WHERE code = ?").bind(codeNorm).run();

      return jsonResponse({ success: true, message: "Código de convite revogado com sucesso." });
    }

    // Roteamento Gemini e CRM
    if (path === "/api/gemini/second-brain/synthesize") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não permitido" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const apiKey = env.GEMINI_API_KEY;
        const body: any = await request.json();
        const { clientId, clientData } = body || {};

        if (!clientId && !clientData) {
          return new Response(
            JSON.stringify({ error: "O clientId ou dados do lead são obrigatórios." }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        let client: any = clientData || null;
        let commentsText = "";

        if (env.DB && clientId) {
          try {
            const clientRow: any = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(clientId).first();
            if (clientRow) {
              client = clientRow;
            }
            const commentsResult = await env.DB.prepare("SELECT * FROM client_comments WHERE client_id = ? ORDER BY created_at DESC").bind(clientId).all();
            if (commentsResult.results && commentsResult.results.length > 0) {
              commentsText = commentsResult.results.map((c: any) => `- [${c.created_at}] ${c.text}`).join("\n");
            }
          } catch (dbErr) {
            console.warn("[Worker Second Brain] Aviso ao buscar dados no D1:", dbErr);
          }
        }

        if (!client) {
          return new Response(
            JSON.stringify({ error: "Cliente não encontrado no CRM." }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!commentsText && client.comments && Array.isArray(client.comments)) {
          commentsText = client.comments.map((c: any) => `- [${c.date || "Data"}] ${c.text}`).join("\n");
        }

        let tagsList = "";
        try {
          tagsList = Array.isArray(client.tags) ? client.tags.join(", ") : (typeof client.tags === "string" ? JSON.parse(client.tags).join(", ") : client.tags || "Nenhuma");
        } catch {
          tagsList = client.tags || "Nenhuma";
        }

        const systemPrompt = `Você é o Merlin Second Brain, o módulo de inteligência comportamental, psicologia de vendas imobiliárias e metodologia comercial humanizada.
Sua missão é analisar profundamente o histórico do lead, suas conversas, perfil, dores, hesitações e momento de vida para sintetizar um dossiê tático para o corretor.

Você DEVE responder ESTRITAMENTE com um objeto JSON válido no seguinte formato exato (sem texto antes ou depois):
{
  "emotionalPain": "string (motivação profunda e momento de vida - ex: busca estabilidade para os filhos, cansado de pagar aluguel caro, deseja rentabilidade segura)",
  "keyObjection": "string (principal barreira, medo ou receio percebido - ex: receio do valor da parcela, dúvida entre duas localizações, insegurança quanto ao prazo de entrega)",
  "decisionCriteria": "string (o fator que define o fechamento - ex: entrada parcelada, vaga de garagem coberta, proximidade com o trabalho)",
  "recommendedAngle": "string (gancho persuasivo ideal e tom recomendado para a próxima abordagem)",
  "suggestedNextAction": "string (próximo passo prático e recomendação tática clara para o corretor)",
  "urgencyLevel": "Alta" | "Média" | "Baixa"
}`;

        const userPrompt = `Analise os dados deste lead imobiliário:
- Nome: ${client.name}
- Etapa do Funil: ${client.status || "Lead Novo"}
- Empreendimento de Interesse: ${client.empreendimento || "Não especificado"}
- Origem do Lead: ${client.origem || "Não informada"}
- Perfil & Notas Cadastradas: ${client.notes || "Sem notas adicionais"}
- Etiquetas/Tags: ${tagsList || "Nenhuma"}
- Histórico de Atendimentos e Conversas:
${commentsText || "Nenhum atendimento registrado ainda."}

Gere o JSON de síntese comportamental do Second Brain:`;

        const now = new Date().toISOString();

        const generateFallbackSynthesis = () => {
          const isUrgent = client.status === "Proposta" || client.status === "Documentação" || client.status === "Visitou";
          const isLow = client.status === "Perdido";
          const urgency: "Alta" | "Média" | "Baixa" = isUrgent ? "Alta" : isLow ? "Baixa" : "Média";
          const emp = client.empreendimento || "o imóvel de interesse";
          return {
            emotionalPain: client.notes ? `Necessidade de segurança e adequação ao momento de vida: ${client.notes.slice(0, 120)}` : `Busca por realização patrimonial e conquista de um novo padrão de vida em ${emp}.`,
            keyObjection: commentsText ? `Hesitação com relação a fluxo de pagamento ou necessidade de alinhamento familiar.` : `Incerteza sobre valores de parcelas ou melhores opções de financiamento.`,
            decisionCriteria: `Transparência nos custos, facilidade na entrada e boa localização.`,
            recommendedAngle: `Abordagem acolhedora, focada em apresentar uma simulação personalizada e esclarecer dúvidas sem pressão.`,
            suggestedNextAction: `Fazer contato via WhatsApp apresentando novidades de ${emp} e sugerir um alinhamento rápido.`,
            urgencyLevel: urgency
          };
        };

        let summary: any;
        if (apiKey) {
          try {
            const rawText = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.4);
            let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
            const firstBrace = cleaned.indexOf("{");
            const lastBrace = cleaned.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleaned = cleaned.slice(firstBrace, lastBrace + 1);
            }
            summary = JSON.parse(cleaned);
            if (!summary.emotionalPain || !summary.keyObjection || !summary.recommendedAngle) {
              throw new Error("Estrutura JSON incompleta.");
            }
          } catch (aiErr: any) {
            console.warn("[Worker Second Brain] Fallback de síntese acionado:", aiErr.message);
            summary = generateFallbackSynthesis();
          }
        } else {
          summary = generateFallbackSynthesis();
        }

        if (env.DB && clientId) {
          try {
            const summaryStr = JSON.stringify(summary);
            await env.DB.prepare(
              "UPDATE clients SET second_brain_summary = ?, second_brain_updated_at = ?, updated_at = ? WHERE id = ?"
            ).bind(summaryStr, now, now, clientId).run();
          } catch (dbUpdateErr) {
            console.warn("[Worker Second Brain] Aviso ao atualizar clients no D1:", dbUpdateErr);
          }
        }

        return new Response(JSON.stringify({ success: true, summary, updatedAt: now }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (error: any) {
        console.error("Erro no Worker second-brain/synthesize:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message || "Erro interno ao processar Second Brain." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

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
        const {
          clientName,
          clientInterest,
          clientNotes,
          goal,
          clientStatus,
          secondBrainSummary,
          playbookIntent = "primeiro-contato",
          brokerName = "seu consultor",
          customInstructions
        } = body || {};

        if (!clientName) {
          return new Response(
            JSON.stringify({ error: "O nome do cliente é obrigatório." }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const intentId = (playbookIntent as PlaybookPillarId) || "primeiro-contato";
        const systemPrompt = buildPlaybookSystemPrompt();

        let secondBrainContext = "";
        if (secondBrainSummary && typeof secondBrainSummary === "object") {
          secondBrainContext = `
- Síntese Comportamental do Lead (Second Brain):
  * Dor Emocional / Momento: ${secondBrainSummary.emotionalPain || "Não identificada"}
  * Principal Objeção: ${secondBrainSummary.keyObjection || "Não identificada"}
  * Critério de Decisão: ${secondBrainSummary.decisionCriteria || "Não especificado"}
  * Ângulo Recomendado: ${secondBrainSummary.recommendedAngle || "Abordagem consultiva"}
  * Nível de Urgência: ${secondBrainSummary.urgencyLevel || "Média"}
*Diretriz Comportamental*: Use estes insights para direcionar a mensagem, eliminando objeções com naturalidade.`;
        }

        const userPrompt = `Gere scripts de abordagem comercial para este lead aplicando o Livreto de Scripts Comerciais:
- Nome do Cliente: ${clientName}
- Nome do Corretor/Consultor: ${brokerName}
- Empreendimento de Interesse: ${clientInterest || "Não especificado ainda"}
- Perfil/Notas do Cliente: ${clientNotes || "Sem observações adicionais"}
- Etapa atual do Funil: ${clientStatus || "Lead Novo"}
- Pilar / Intenção do Playbook: ${intentId}
- Objetivo Declarado: ${goal || "Conduzir para o próximo passo"}
${customInstructions ? `- Instrução Adicional do Corretor: ${customInstructions}` : ""}
${secondBrainContext}

REGRAS MANDATÓRIAS:
1. NÃO faça infodump. Mantenha os textos enxutos, humanos e prontos para WhatsApp.
2. Cada uma das 2 opções DEVE TERMINAR OBRIGATORIAMENTE com uma pergunta em DUPLA ALTERNATIVA (either/or).
3. Retorne ESTRITAMENTE o JSON estruturado com 'options' (contendo a Opção Direta e a Opção Consultiva) e 'goldenTip'.`;

        let responseData: any;
        try {
          const rawText = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.6);
          let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
          const firstBrace = cleaned.indexOf("{");
          const lastBrace = cleaned.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1);
          }

          const parsed = JSON.parse(cleaned);
          if (parsed.options && Array.isArray(parsed.options) && parsed.options.length > 0) {
            responseData = {
              success: true,
              options: parsed.options,
              goldenTip: parsed.goldenTip || "Conduza com uma pergunta por vez.",
              text: parsed.options[0]?.text || ""
            };
          } else {
            throw new Error("Formato JSON sem 'options' válidas.");
          }
        } catch (genError: any) {
          console.warn("[Worker] Falha ao processar com Gemini, usando fallback de alta fidelidade do Playbook:", genError.message);
          const fallback = getPlaybookFallbackOptions(intentId, {
            name: clientName,
            empreendimento: clientInterest,
            notes: clientNotes,
            brokerName
          });
          responseData = {
            success: true,
            options: fallback.options,
            goldenTip: fallback.goldenTip,
            text: fallback.options[0]?.text || ""
          };
        }

        return new Response(JSON.stringify(responseData), {
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

            let secondBrainSummaryParsed = undefined;
            if (row.second_brain_summary) {
              try {
                secondBrainSummaryParsed = typeof row.second_brain_summary === "string" ? JSON.parse(row.second_brain_summary) : row.second_brain_summary;
              } catch {
                secondBrainSummaryParsed = row.second_brain_summary;
              }
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
              secondBrainSummary: secondBrainSummaryParsed,
              secondBrainUpdatedAt: row.second_brain_updated_at || undefined,
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
                const secondBrainJson = client.secondBrainSummary 
                  ? (typeof client.secondBrainSummary === "string" ? client.secondBrainSummary : JSON.stringify(client.secondBrainSummary))
                  : null;
                statements.push(
                  env.DB.prepare(
                    `INSERT INTO clients (id, name, phone, email, empreendimento, origem, status, notes, tags, next_contact_date, contact_count, last_contact_date, second_brain_summary, second_brain_updated_at, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                       name=excluded.name, phone=excluded.phone, email=excluded.email, empreendimento=excluded.empreendimento,
                       origem=excluded.origem, status=excluded.status, notes=excluded.notes, tags=excluded.tags,
                       next_contact_date=excluded.next_contact_date, contact_count=excluded.contact_count,
                       last_contact_date=excluded.last_contact_date,
                       second_brain_summary=COALESCE(excluded.second_brain_summary, clients.second_brain_summary),
                       second_brain_updated_at=COALESCE(excluded.second_brain_updated_at, clients.second_brain_updated_at),
                       updated_at=excluded.updated_at`
                  ).bind(
                    client.id, client.name, client.phone || "", client.email || "", client.empreendimento || "", client.origem || "",
                    client.status || "Lead Novo", client.notes || "", tagsJson, client.nextContactDate || null,
                    client.contactCount || 0, client.lastContactDate || null,
                    secondBrainJson, client.secondBrainUpdatedAt || null,
                    client.createdAt || now, now
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

    // Para rotas de API não tratadas, SEMPRE retornar JSON válido com Content-Type application/json
    if (path.startsWith("/api/")) {
      return errorResponse(`Endpoint da API não encontrado: ${path}`, 404);
    }

    // Para qualquer outra requisição estática no Cloudflare Worker (wrangler v3 com assets)
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      try {
        return await env.ASSETS.fetch(request);
      } catch (assetErr) {
        console.warn("[Worker Assets] Erro ao servir asset estático:", assetErr);
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders }
    });
  }
};
