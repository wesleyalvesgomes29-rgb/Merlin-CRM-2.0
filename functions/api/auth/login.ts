import { getAuthCorsHeaders, hashPasswordWithSalt } from "./_auth_utils";

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
    const { email, password } = body || {};

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const emailNorm = email.trim().toLowerCase();

    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: "usr_mock",
            name: email.split("@")[0],
            email: emailNorm,
            role: "admin",
            createdAt: new Date().toISOString()
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(emailNorm).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "E-mail ou senha incorretos." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const computedHash = await hashPasswordWithSalt(password, user.salt);
    if (computedHash !== user.password_hash) {
      return new Response(JSON.stringify({ error: "E-mail ou senha incorretos." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cloudflare D1 Auth] Erro no login:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro no login." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
