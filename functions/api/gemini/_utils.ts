export async function generateWithFallbackAndTimeout(
  apiKey: string,
  userPrompt: string,
  systemPrompt: string,
  temperature: number
): Promise<string> {
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
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
      
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Cloudflare Pages] Conteúdo gerado com sucesso pelo modelo: ${model}`);
        return data.candidates[0].content.parts[0].text;
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
