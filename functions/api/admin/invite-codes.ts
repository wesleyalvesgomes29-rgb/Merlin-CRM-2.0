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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const adminUserId = request.headers.get("X-User-Id") || url.searchParams.get("userId");

    if (!adminUserId) {
      return errorResponse("Acesso não autorizado.", 401, corsHeaders);
    }

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          invites: [
            {
              code: "MERLIN-ADMIN-2026",
              created_by: "system",
              used_by: null,
              used_at: null,
              is_active: 1,
              created_at: new Date().toISOString(),
            },
          ],
        },
        200,
        corsHeaders
      );
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

    return jsonResponse(
      {
        success: true,
        invites: result.results || [],
      },
      200,
      corsHeaders
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao listar convites:", error);
    return errorResponse(error.message || "Erro ao consultar convites.", 500, corsHeaders);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") {
    return onRequestOptions(context);
  }
  if (context.request.method === "GET") {
    return onRequestGet(context);
  }
  const corsHeaders = getAuthCorsHeaders(context.request);
  return errorResponse("Método não permitido", 405, corsHeaders);
};

