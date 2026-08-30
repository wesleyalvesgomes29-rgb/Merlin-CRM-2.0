import { getAuthCorsHeaders, generateRandomInviteCode } from "../auth/_auth_utils";

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
    const adminUserId = request.headers.get("X-User-Id");
    const body: any = await request.json().catch(() => ({}));
    const { customCode, adminUserId: bodyAdminId } = body || {};
    const effectiveAdminId = adminUserId || bodyAdminId;

    if (!effectiveAdminId) {
      return new Response(JSON.stringify({ error: "Acesso não autorizado." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!env.DB) {
      const code = (customCode ? customCode.trim().toUpperCase() : generateRandomInviteCode()).replace(/\s+/g, '-');
      return new Response(
        JSON.stringify({
          success: true,
          invite: {
            code,
            created_by: effectiveAdminId,
            used_by: null,
            used_at: null,
            is_active: 1,
            created_at: new Date().toISOString()
          }
        }),
        { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Valida se o usuário solicitante é admin
    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first();
    if (!user || user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerar códigos de convite." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const code = (customCode ? customCode.trim().toUpperCase() : generateRandomInviteCode()).replace(/\s+/g, '-');
    const existing = await env.DB.prepare("SELECT code FROM invite_codes WHERE code = ?").bind(code).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "Este código de convite já existe." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO invite_codes (code, created_by, used_by, used_at, is_active, created_at) VALUES (?, ?, NULL, NULL, 1, ?)"
    ).bind(code, effectiveAdminId, now).run();

    return new Response(
      JSON.stringify({
        success: true,
        invite: {
          code,
          created_by: effectiveAdminId,
          used_by: null,
          used_at: null,
          is_active: 1,
          created_at: now
        }
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao criar convite:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao criar código de convite." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
