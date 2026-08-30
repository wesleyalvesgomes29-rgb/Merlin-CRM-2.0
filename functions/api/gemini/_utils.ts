export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (!origin) {
    return headers;
  }

  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname.toLowerCase();

    // Validação de origens seguras: localhost, domínios Cloudflare Pages (*.pages.dev), Cloud Run (*.run.app) ou mesmo host
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isCloudflarePages = hostname.endsWith(".pages.dev");
    const isCloudRun = hostname.endsWith(".run.app");
    const isSameHost = host ? (originUrl.host === host || hostname === host.split(":")[0]) : false;

    if (isLocalhost || isCloudflarePages || isCloudRun || isSameHost) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  } catch {
    // Origem com formato inválido - não adiciona cabeçalho permissivo
  }

  return headers;
}

export async function generateWithFallbackAndTimeout(
  apiKey: string,
  userPrompt: string,
  systemPrompt: string,
  temperature: number
): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Cloudflare Pages] Tentando gerar conteúdo usando modelo: ${model}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: temperature
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim().length > 0) {
        console.log(`[Cloudflare Pages] Conteúdo gerado com sucesso pelo modelo: ${model}`);
        return text.trim();
      }
      
      if (data.error) {
        throw new Error(`Erro da API Gemini: ${data.error.message || JSON.stringify(data.error)}`);
      }

      throw new Error(`O modelo ${model} retornou uma resposta em formato inesperado.`);
    } catch (error: any) {
      const msg = error.name === "AbortError" 
        ? `Timeout de 20 segundos atingido para o modelo ${model}.` 
        : (error.message || error);
      console.error(`[Cloudflare Pages] Falha ao gerar com modelo ${model}:`, msg);
      lastError = new Error(msg);
    }
  }

  throw lastError || new Error("Falha ao gerar conteúdo com todos os modelos disponíveis.");
}

