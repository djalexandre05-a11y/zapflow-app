import { createServerFn } from "@tanstack/react-start";

export const generateDraft = createServerFn({ method: "POST" })
  .validator((d: { apiKey: string, systemPrompt: string, history: { role: string, content: string }[] }) => d)
  .handler(async ({ data }) => {
  const { apiKey, systemPrompt, history } = data;
  
  if (!apiKey) throw new Error("Chave da OpenAI não fornecida.");

  try {
    const messages = [
      { role: "system", content: systemPrompt || "Você é um assistente prestativo. Seja conciso e educado." },
      ...history.map(m => ({
        role: m.role === "outgoing" ? "assistant" : "user",
        content: m.content
      }))
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Erro na API da OpenAI");
    }

    return { text: data.choices[0].message.content as string };
  } catch (err: any) {
    throw new Error(err.message || "Falha ao gerar rascunho com a IA.");
  }
});
