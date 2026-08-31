import { 
  getAuthCorsHeaders, 
  hashPasswordWithSalt, 
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

    const { email, password } = body || {};

    if (!email || !password) {
      return errorResponse("E-mail e senha são obrigatórios.", 400, corsHeaders);
    }

    const emailNorm = email.trim().toLowerCase();

    // Fallback se o D1 Database não estiver vinculado nesta instância
    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          user: {
            id: "usr_mock",
            name: email.split("@")[0],
            email: emailNorm,
            role: "admin",
            createdAt: new Date().toISOString(),
          },
        },
        200,
        corsHeaders
      );
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(emailNorm).first<any>();
    if (!user) {
      return errorResponse("E-mail ou senha incorretos.", 401, corsHeaders);
    }

    const computedHash = await hashPasswordWithSalt(password, user.salt);
    if (computedHash !== user.password_hash) {
      return errorResponse("E-mail ou senha incorretos.", 401, corsHeaders);
    }

    return jsonResponse(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
        },
      },
      200,
      corsHeaders
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Auth] Erro no login:", error);
    return errorResponse(error.message || "Erro interno ao processar login.", 500, corsHeaders);
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

