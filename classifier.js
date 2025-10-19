import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function classifySecretaria(descricao) {
  const prompt = `
  relacione o problema abaixo com alguma das secretarias do município de Porto Velho (qual é a responsável pela resolução do problema):
  "${descricao}"

  Secretarias: PGM, SMTI, SEMED, SEINFRA, SECOM, SEMIAS, SEMAGRIC, SEMTRAN, SEMASF, SEMA, SEMPOG, SEMDEC, SGG, SEMAD, SEMESC, SEMUSA, SEMOB, SEMFAZ, SEMDESTUR, SEMES, SEMUSB, SESB, SEMUR, SEMTEL. Caso nenhuma seja compatível, retorne exclusivamente a secretaria. Quero que você me responda apenas com o nome da secretaria em que o problema se encaixa.
  `;

  console.log("🔥 Teste de ambiente:", {
    chave: process.env.OPENAI_API_KEY ? "Carregada" : "Faltando",
    descricao,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    console.log(response);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao interpretar resposta da OpenAI:", error);
    return "error";
  }
}
