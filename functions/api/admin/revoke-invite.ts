import { 
  getAuthCorsHeaders, 
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

    const { code, adminUserId: bodyAdminId } = body || {};
    const effectiveAdminId = adminUserId || bodyAdminId;

    if (!effectiveAdminId || !code) {
      return errorResponse("Parâmetros insuficientes.", 400, corsHeaders);
    }

    if (!env.DB) {
      return jsonResponse(
        { success: true, message: "Código revogado." },
        200,
        corsHeaders
      );
    }

    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first<any>();
    if (!user || user.role !== "admin") {
      return errorResponse("Acesso restrito a administradores.", 403, corsHeaders);
    }

    const codeNorm = code.trim().toUpperCase();
    await env.DB.prepare("UPDATE invite_codes SET is_active = 0 WHERE code = ?").bind(codeNorm).run();

    return jsonResponse(
      { success: true, message: "Código de convite revogado com sucesso." },
      200,
      corsHeaders
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao revogar convite:", error);
    return errorResponse(error.message || "Erro ao revogar código.", 500, corsHeaders);
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

