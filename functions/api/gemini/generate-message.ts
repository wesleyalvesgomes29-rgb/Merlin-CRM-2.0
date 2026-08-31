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
      brokerName,
      companyName,
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

    const effectiveBrokerName = (brokerName && typeof brokerName === "string" && brokerName.trim()) ? brokerName.trim() : "consultor imobiliário";
    const effectiveCompanyName = (companyName && typeof companyName === "string" && companyName.trim()) ? companyName.trim() : "consultoria imobiliária especializada";

    const intentId = (playbookIntent as PlaybookPillarId) || "primeiro-contato";
    const systemPrompt = buildPlaybookSystemPrompt(effectiveCompanyName);

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

    const userPrompt = `Gere scripts de abordagem comercial para este lead aplicando rigorosamente o Livreto de Scripts Comerciais:
- Nome do Cliente: ${clientName}
- Nome do Corretor/Consultor: ${effectiveBrokerName}
- Imobiliária / Construtora / Empresa: ${effectiveCompanyName}
- Empreendimento de Interesse: ${clientInterest || "um dos nossos empreendimentos"}
- Perfil/Notas do Cliente: ${clientNotes || "Lead recém-chegado (sem observações anteriores)"}
- Etapa atual do Funil: ${clientStatus || "Lead Novo"}
- Pilar / Intenção Selecionada: ${intentId}
- Objetivo Declarado: ${goal || "Conduzir para o próximo passo"}
${customInstructions ? `- Instrução Específica do Corretor: ${customInstructions}` : ""}
${secondBrainContext}

🚫 PROIBIÇÕES ABSOLUTAS:
1. NUNCA mencione "cadastro com pendências", "dados incompletos", "atualizar cadastro no sistema", "falta de informações" ou qualquer jargão de CRM.
2. Campos em branco significam apenas que o lead acabou de chegar, JAMAIS que ele está pendente ou com problemas.
3. Se for 'primeiro-contato', siga a fórmula acolhedora exata do Playbook: Saudação calorosa + apresentação como consultor (${effectiveBrokerName}${effectiveCompanyName !== "consultoria imobiliária especializada" ? ` da ${effectiveCompanyName}` : ""}) + conexão com interesse no imóvel + pergunta mandatória "Hoje você busca o imóvel mais para morar ou investir?".
4. NUNCA use nomes fictícios como "Wesley" ou "INC Empreendimentos" a menos que exatamente esses nomes tenham sido informados nos campos acima.

REGRAS MANDATÓRIAS:
1. Textos 100% humanizados, acolhedores, sem infodump e prontos para envio no WhatsApp.
2. Cada uma das 2 opções DEVE TERMINAR OBRIGATORIAMENTE com uma pergunta em DUPLA ALTERNATIVA (either/or).
3. Retorne ESTRITAMENTE o JSON estruturado com 'options' (Opção Direta e Opção Consultiva) e 'goldenTip'.`;

    let responseData: any;

    if (!apiKey) {
      console.warn("[Cloudflare Pages] GEMINI_API_KEY ausente, acionando fallback estruturado do Playbook.");
      const fallback = getPlaybookFallbackOptions(intentId, {
        name: clientName,
        empreendimento: clientInterest,
        notes: clientNotes,
        brokerName: effectiveBrokerName,
        companyName: effectiveCompanyName !== "consultoria imobiliária especializada" ? effectiveCompanyName : undefined
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
          brokerName: effectiveBrokerName,
          companyName: effectiveCompanyName !== "consultoria imobiliária especializada" ? effectiveCompanyName : undefined
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


