import { getAuthCorsHeaders } from "../auth/_auth_utils";

interface Env {
  DB?: any;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const corsHeaders = getAuthCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const adminUserId = request.headers.get("X-User-Id") || url.searchParams.get("userId");

    if (!adminUserId) {
      return new Response(JSON.stringify({ error: "Acesso não autorizado." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: true,
          invites: [
            {
              code: "MERLIN-ADMIN-2026",
              created_by: "system",
              used_by: null,
              used_at: null,
              is_active: 1,
              created_at: new Date().toISOString()
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(adminUserId).first();
    if (!user || user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem visualizar convites." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
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

    return new Response(
      JSON.stringify({
        success: true,
        invites: result.results || []
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao listar convites:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao consultar convites." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
