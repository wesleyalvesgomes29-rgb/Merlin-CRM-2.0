import { generateWithFallbackAndTimeout, getCorsHeaders } from "../_utils";

interface Env {
  GEMINI_API_KEY?: string;
  DB?: any;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  try {
    const apiKey = env.GEMINI_API_KEY;
    const body: any = await request.json();
    const { clientId, clientData } = body || {};

    if (!clientId && !clientData) {
      return new Response(
        JSON.stringify({ error: "O clientId ou dados do lead são obrigatórios." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let client: any = clientData || null;
    let commentsText = "";

    if (env.DB && clientId) {
      try {
        const clientRow: any = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(clientId).first();
        if (clientRow) {
          client = clientRow;
        }
        const commentsResult = await env.DB.prepare("SELECT * FROM client_comments WHERE client_id = ? ORDER BY created_at DESC").bind(clientId).all();
        if (commentsResult.results && commentsResult.results.length > 0) {
          commentsText = commentsResult.results.map((c: any) => `- [${c.created_at}] ${c.text}`).join("\n");
        }
      } catch (dbErr) {
        console.warn("[Functions Second Brain] Aviso ao buscar dados no D1:", dbErr);
      }
    }

    if (!client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado no CRM." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!commentsText && client.comments && Array.isArray(client.comments)) {
      commentsText = client.comments.map((c: any) => `- [${c.date || "Data"}] ${c.text}`).join("\n");
    }

    let tagsList = "";
    try {
      tagsList = Array.isArray(client.tags) ? client.tags.join(", ") : (typeof client.tags === "string" ? JSON.parse(client.tags).join(", ") : client.tags || "Nenhuma");
    } catch {
      tagsList = client.tags || "Nenhuma";
    }

    const systemPrompt = `Você é o Merlin Second Brain, o módulo de inteligência comportamental, psicologia de vendas imobiliárias e metodologia comercial humanizada.
Sua missão é analisar profundamente o histórico do lead, suas conversas, perfil, dores, hesitações e momento de vida para sintetizar um dossiê tático para o corretor.

Você DEVE responder ESTRITAMENTE com um objeto JSON válido no seguinte formato exato (sem texto antes ou depois):
{
  "emotionalPain": "string (motivação profunda e momento de vida - ex: busca estabilidade para os filhos, cansado de pagar aluguel caro, deseja rentabilidade segura)",
  "keyObjection": "string (principal barreira, medo ou receio percebido - ex: receio do valor da parcela, dúvida entre duas localizações, insegurança quanto ao prazo de entrega)",
  "decisionCriteria": "string (o fator que define o fechamento - ex: entrada parcelada, vaga de garagem coberta, proximidade com o trabalho)",
  "recommendedAngle": "string (gancho persuasivo ideal e tom recomendado para a próxima abordagem)",
  "suggestedNextAction": "string (próximo passo prático e recomendação tática clara para o corretor)",
  "urgencyLevel": "Alta" | "Média" | "Baixa"
}`;

    const userPrompt = `Analise os dados deste lead imobiliário:
- Nome: ${client.name}
- Etapa do Funil: ${client.status || "Lead Novo"}
- Empreendimento de Interesse: ${client.empreendimento || "Não especificado"}
- Origem do Lead: ${client.origem || "Não informada"}
- Perfil & Notas Cadastradas: ${client.notes || "Sem notas adicionais"}
- Etiquetas/Tags: ${tagsList || "Nenhuma"}
- Histórico de Atendimentos e Conversas:
${commentsText || "Nenhum atendimento registrado ainda."}

Gere o JSON de síntese comportamental do Second Brain:`;

    const now = new Date().toISOString();

    const generateFallbackSynthesis = () => {
      const isUrgent = client.status === "Proposta" || client.status === "Documentação" || client.status === "Visitou";
      const isLow = client.status === "Perdido";
      const urgency: "Alta" | "Média" | "Baixa" = isUrgent ? "Alta" : isLow ? "Baixa" : "Média";
      const emp = client.empreendimento || "o imóvel de interesse";
      return {
        emotionalPain: client.notes ? `Necessidade de segurança e adequação ao momento de vida: ${client.notes.slice(0, 120)}` : `Busca por realização patrimonial e conquista de um novo padrão de vida em ${emp}.`,
        keyObjection: commentsText ? `Hesitação com relação a fluxo de pagamento ou necessidade de alinhamento familiar.` : `Incerteza sobre valores de parcelas ou melhores opções de financiamento.`,
        decisionCriteria: `Transparência nos custos, facilidade na entrada e boa localização.`,
        recommendedAngle: `Abordagem acolhedora, focada em apresentar uma simulação personalizada e esclarecer dúvidas sem pressão.`,
        suggestedNextAction: `Fazer contato via WhatsApp apresentando novidades de ${emp} e sugerir um alinhamento rápido.`,
        urgencyLevel: urgency
      };
    };

    let summary: any;
    if (apiKey) {
      try {
        const rawText = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.4);
        let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }
        summary = JSON.parse(cleaned);
        if (!summary.emotionalPain || !summary.keyObjection || !summary.recommendedAngle) {
          throw new Error("Estrutura JSON incompleta.");
        }
      } catch (aiErr: any) {
        console.warn("[Functions Second Brain] Fallback de síntese acionado:", aiErr.message);
        summary = generateFallbackSynthesis();
      }
    } else {
      summary = generateFallbackSynthesis();
    }

    if (env.DB && clientId) {
      try {
        const summaryStr = JSON.stringify(summary);
        await env.DB.prepare(
          "UPDATE clients SET second_brain_summary = ?, second_brain_updated_at = ?, updated_at = ? WHERE id = ?"
        ).bind(summaryStr, now, now, clientId).run();
      } catch (dbUpdateErr) {
        console.warn("[Functions Second Brain] Aviso ao atualizar clients no D1:", dbUpdateErr);
      }
    }

    return new Response(JSON.stringify({ success: true, summary, updatedAt: now }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: any) {
    console.error("Erro no Functions second-brain/synthesize:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno ao processar Second Brain." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
