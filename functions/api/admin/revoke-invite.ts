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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const adminUserId = request.headers.get("X-User-Id");
    const body: any = await request.json().catch(() => ({}));
    const { code, adminUserId: bodyAdminId } = body || {};
    const effectiveAdminId = adminUserId || bodyAdminId;

    if (!effectiveAdminId || !code) {
      return new Response(JSON.stringify({ error: "Parâmetros insuficientes." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: true, message: "Código revogado." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(effectiveAdminId).first();
    if (!user || user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const codeNorm = code.trim().toUpperCase();
    await env.DB.prepare("UPDATE invite_codes SET is_active = 0 WHERE code = ?").bind(codeNorm).run();

    return new Response(
      JSON.stringify({ success: true, message: "Código de convite revogado com sucesso." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Admin] Erro ao revogar convite:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao revogar código." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
