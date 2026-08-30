import { 
  getAuthCorsHeaders, 
  generateRandomSalt, 
  hashPasswordWithSalt, 
  MASTER_INVITE_CODE 
} from "./_auth_utils";

interface Env {
  DB?: any;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body: any = await request.json();
    const { name, email, password, inviteCode } = body || {};

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "O nome completo é obrigatório." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!email || !email.trim() || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Informe um endereço de e-mail válido." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!inviteCode || !inviteCode.trim()) {
      return new Response(JSON.stringify({ error: "O Código de Convite é obrigatório." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const emailNorm = email.trim().toLowerCase();
    const codeNorm = inviteCode.trim().toUpperCase();

    if (!env.DB) {
      // Fallback em ambiente sem D1
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: "usr_" + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            email: emailNorm,
            role: codeNorm === MASTER_INVITE_CODE ? "admin" : "broker",
            createdAt: new Date().toISOString()
          }
        }),
        { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 1. Verifica se usuário já existe
    const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(emailNorm).first();
    if (existingUser) {
      return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. Valida código de convite
    const isMaster = codeNorm === MASTER_INVITE_CODE;
    let role = isMaster ? "admin" : "broker";

    if (!isMaster) {
      const invite = await env.DB.prepare("SELECT * FROM invite_codes WHERE code = ?").bind(codeNorm).first();
      if (!invite || invite.is_active !== 1 || invite.used_by) {
        return new Response(JSON.stringify({ error: "Código de convite inválido ou expirado" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 3. Cria usuário
    const userId = "usr_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          name: name.trim(),
          email: emailNorm,
          role: role,
          createdAt: now
        }
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Auth] Erro no registro:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao registrar usuário." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
