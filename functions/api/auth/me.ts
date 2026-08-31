import { 
  getAuthCorsHeaders, 
  jsonResponse, 
  errorResponse,
  Env,
  PagesFunction
} from "./_auth_utils";

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const corsHeaders = getAuthCorsHeaders(context.request);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const userId = request.headers.get("X-User-Id") || url.searchParams.get("userId");

    if (!userId) {
      return errorResponse("Não autenticado.", 401, corsHeaders);
    }

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          user: {
            id: userId,
            name: "Corretor",
            email: "corretor@merlin.crm",
            role: "admin",
            createdAt: new Date().toISOString(),
          },
        },
        200,
        corsHeaders
      );
    }

    const user = await env.DB.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").bind(userId).first<any>();
    if (!user) {
      return errorResponse("Usuário não encontrado.", 404, corsHeaders);
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
    console.error("[Cloudflare D1 Auth] Erro no /api/auth/me:", error);
    return errorResponse(error.message || "Erro ao consultar usuário.", 500, corsHeaders);
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
