import { generateWithFallbackAndTimeout, getCorsHeaders } from "./_utils";
import { buildPlaybookSystemPrompt, getPlaybookFallbackOptions, PlaybookPillarId } from "../../../src/lib/salesPlaybook";

interface Env {
  GEMINI_API_KEY?: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Handle preflight OPTIONS
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
    const {
      clientName,
      clientInterest,
      clientNotes,
      goal,
      clientStatus,
      secondBrainSummary,
      playbookIntent = "primeiro-contato",
      brokerName = "seu consultor",
      customInstructions
    } = body || {};

    if (!clientName) {
      return new Response(
        JSON.stringify({ error: "O nome do cliente é obrigatório." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const intentId = (playbookIntent as PlaybookPillarId) || "primeiro-contato";
    const systemPrompt = buildPlaybookSystemPrompt();

    let secondBrainContext = "";
    if (secondBrainSummary && typeof secondBrainSummary === "object") {
      secondBrainContext = `
- Síntese Comportamental do Lead (Second Brain):
  * Dor Emocional / Momento: ${secondBrainSummary.emotionalPain || "Não identificada"}
  * Principal Objeção: ${secondBrainSummary.keyObjection || "Não identificada"}
  * Critério de Decisão: ${secondBrainSummary.decisionCriteria || "Não especificado"}
  * Ângulo Recomendado: ${secondBrainSummary.recommendedAngle || "Abordagem consultiva"}
  * Nível de Urgência: ${secondBrainSummary.urgencyLevel || "Média"}
*Diretriz Comportamental*: Use estes insights para direcionar a mensagem, eliminando objeções com naturalidade.`;
    }

    const userPrompt = `Gere scripts de abordagem comercial para este lead aplicando o Livreto de Scripts Comerciais:
- Nome do Cliente: ${clientName}
- Nome do Corretor/Consultor: ${brokerName}
- Empreendimento de Interesse: ${clientInterest || "Não especificado ainda"}
- Perfil/Notas do Cliente: ${clientNotes || "Sem observações adicionais"}
- Etapa atual do Funil: ${clientStatus || "Lead Novo"}
- Pilar / Intenção do Playbook: ${intentId}
- Objetivo Declarado: ${goal || "Conduzir para o próximo passo"}
${customInstructions ? `- Instrução Adicional do Corretor: ${customInstructions}` : ""}
${secondBrainContext}

REGRAS MANDATÓRIAS:
1. NÃO faça infodump. Mantenha os textos enxutos, humanos e prontos para WhatsApp.
2. Cada uma das 2 opções DEVE TERMINAR OBRIGATORIAMENTE com uma pergunta em DUPLA ALTERNATIVA (either/or).
3. Retorne ESTRITAMENTE o JSON estruturado com 'options' (contendo a Opção Direta e a Opção Consultiva) e 'goldenTip'.`;

    let responseData: any;

    if (!apiKey) {
      console.warn("[Cloudflare Pages] GEMINI_API_KEY ausente, acionando fallback estruturado do Playbook.");
      const fallback = getPlaybookFallbackOptions(intentId, {
        name: clientName,
        empreendimento: clientInterest,
        notes: clientNotes,
        brokerName
      });
      responseData = {
        success: true,
        options: fallback.options,
        goldenTip: fallback.goldenTip,
        text: fallback.options[0]?.text || ""
      };
    } else {
      try {
        const rawText = await generateWithFallbackAndTimeout(apiKey, userPrompt, systemPrompt, 0.6);
        let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }

        const parsed = JSON.parse(cleaned);
        if (parsed.options && Array.isArray(parsed.options) && parsed.options.length > 0) {
          responseData = {
            success: true,
            options: parsed.options,
            goldenTip: parsed.goldenTip || "Conduza com uma pergunta por vez.",
            text: parsed.options[0]?.text || ""
          };
        } else {
          throw new Error("Formato JSON sem 'options' válidas.");
        }
      } catch (genError: any) {
        console.warn("[Cloudflare Pages] Falha ao processar com Gemini, usando fallback de alta fidelidade do Playbook:", genError.message);
        const fallback = getPlaybookFallbackOptions(intentId, {
          name: clientName,
          empreendimento: clientInterest,
          notes: clientNotes,
          brokerName
        });
        responseData = {
          success: true,
          options: fallback.options,
          goldenTip: fallback.goldenTip,
          text: fallback.options[0]?.text || ""
        };
      }
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro no Cloudflare Function generate-message:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao gerar mensagem." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}


