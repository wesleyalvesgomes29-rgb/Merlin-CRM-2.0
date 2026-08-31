import { 
  getAuthCorsHeaders, 
  generateRandomInviteCode, 
  jsonResponse, 
  errorResponse,
  Env,
  PagesFunction
} from "../auth/_auth_utils";

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const corsHeaders = getAuthCorsHeaders(context.request);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  try {
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

    if (!env.DB) {
      const code = (customCode ? customCode.trim().toUpperCase() : generateRandomInviteCode()).replace(/\s+/g, '-');
      return jsonResponse(
        {
          success: true,
          invite: {
            code,
            created_by: effectiveAdminId,
            used_by: null,
            used_at: null,
            is_active: 1,
            created_at: new Date().toISOString(),
          },
        },
        201,
        corsHeaders
      );
    }

    // Valida se o usuário solicitante é admin
    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first<any>();
    if (!user || user.role !== "admin") {
      return errorResponse("Apenas administradores podem gerar códigos de convite.", 403, corsHeaders);
    }

    const code = (customCode ? customCode.trim().toUpperCase() : generateRandomInviteCode()).replace(/\s+/g, '-');
    const existing = await env.DB.prepare("SELECT code FROM invite_codes WHERE code = ?").bind(code).first<any>();
    if (existing) {
      return errorResponse("Este código de convite já existe.", 400, corsHeaders);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO invite_codes (code, created_by, used_by, used_at, is_active, created_at) VALUES (?, ?, NULL, NULL, 1, ?)"
    ).bind(code, effectiveAdminId, now).run();

    return jsonResponse(
      {
        success: true,
        invite: {
          code,
          created_by: effectiveAdminId,
          used_by: null,
          used_at: null,
          is_active: 1,
          created_at: now,
        },
      },
      201,
      corsHeaders
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao criar convite:", error);
    return errorResponse(error.message || "Erro ao criar código de convite.", 500, corsHeaders);
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

