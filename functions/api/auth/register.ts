import { 
  getAuthCorsHeaders, 
  generateRandomSalt, 
  hashPasswordWithSalt, 
  MASTER_INVITE_CODE,
  jsonResponse,
  errorResponse,
  Env,
  PagesFunction
} from "./_auth_utils";

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const corsHeaders = getAuthCorsHeaders(context.request);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  try {
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

    // Fallback em ambiente sem D1 vinculado diretamente
    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          user: {
            id: "usr_" + Math.random().toString(36).substring(2, 9),
            name: name.trim(),
            email: emailNorm,
            role: codeNorm === MASTER_INVITE_CODE ? "admin" : "broker",
            createdAt: new Date().toISOString(),
          },
        },
        201,
        corsHeaders
      );
    }

    // 1. Verifica se usuário já existe
    const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(emailNorm).first<any>();
    if (existingUser) {
      return errorResponse("Este e-mail já está cadastrado.", 400, corsHeaders);
    }

    // 2. Valida código de convite
    const isMaster = codeNorm === MASTER_INVITE_CODE;
    const role = isMaster ? "admin" : "broker";

    if (!isMaster) {
      const invite = await env.DB.prepare("SELECT * FROM invite_codes WHERE code = ?").bind(codeNorm).first<any>();
      if (!invite || invite.is_active !== 1 || invite.used_by) {
        return errorResponse("Código de convite inválido ou expirado", 403, corsHeaders);
      }
    }

    // 3. Cria usuário
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

    return jsonResponse(
      {
        success: true,
        user: {
          id: userId,
          name: name.trim(),
          email: emailNorm,
          role: role,
          createdAt: now,
        },
      },
      201,
      corsHeaders
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Auth] Erro no registro:", error);
    return errorResponse(error.message || "Erro ao registrar usuário.", 500, corsHeaders);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") {
    return onRequestOptions(context);
  }
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }
  const corsHeaders = getAuthCorsHeaders(context.request);
  return errorResponse("Método não permitido", 405, corsHeaders);
};

