import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { classifySecretaria } from "./classifier.js";

const { Client, LocalAuth } = pkg;
const userStates = new Map();

const initMsgPossibilites = [
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
];

const isValidCPF = (cpf) => {
  const regex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
  return regex.test(cpf);
};

const isValidDate = (date) => {
  const regex = /^([0-2]\d|3[0-1])\/(0\d|1[0-2])\/\d{4}$/;
  return regex.test(date);
};

function resetUserTimer(msgFrom) {
  const userState = userStates.get(msgFrom);
  if (!userState) return;

  // Se já tiver timer ativo, limpa
  if (userState.timeout) {
    clearTimeout(userState.timeout);
  }

  userState.timeout = setTimeout(async () => {
    await client.sendMessage(
      msgFrom,
      "⏰ Sua demanda foi cancelada por inatividade (1 minutos sem resposta)."
    );
    userStates.delete(msgFrom);
  }, 30 * 60 * 1000);
}

async function handleQuestionnaire(msg, userState, client) {
  const text = msg.body.trim().toLowerCase();

  switch (userState.step) {
    case 0:
      userState.step++;
      return "Antes de começar, deseja se identificar? (sim/não)";
    case 1:
      if (text === "sim") {
        userState.step = 2;
        userState.identified = true;
        return "Certo! Escreva seu nome:";
      } else if (text === "não" || text === "nao") {
        userState.step = 5;
        userState.identified = false;
        userState.name = "Anônimo";
        //return "Tudo bem. Vamos continuar.\nPrimeiro, defina em poucas palavras o tipo do problema (ex: buraco, iluminação, lixo, árvore, saúde)";
        return "Tudo bem. Vamos continuar.\nPrimeiro, defina em poucas palavras o tipo do problema (ex: buraco, iluminação, lixo, saúde)";
      } else {
        return "Por favor, responda apenas com 'sim' ou 'não'.";
      }

    case 2:
      userState.name = msg.body.trim();
      userState.step++;
      return "Digite o seu CPF:";

    case 3:
      if (!isValidCPF(msg.body.trim())) {
        return "Escreva o CPF apenas em números ou no formato 000.000.000-00 e tente novamente:";
      }
      userState.cpf = msg.body.trim();
      userState.step = 5;
      return "Perfeito! Agora, defina em poucas palavras o tipo do problema (ex: buraco, iluminação, lixo, árvore, saúde)";

    case 5:
      userState.problemType = msg.body.trim();
      userState.step++;
      return "Deseja informar o endereço do problema? (sim/não)";

    case 6:
      if (text === "sim") {
        userState.step = 7;
        return "Escreva o endereço (rua, bairro, ponto de referência...)";
      } else if (text === "não" || text === "nao") {
        userState.step = 8;
        return "Quando você percebeu o problema pela primeira vez? (ex: 18/10/2025)";
      } else {
        return "Responda apenas com 'sim' ou 'não'.";
      }

    case 7:
      userState.address = msg.body.trim();
      userState.step = 8;
      return "Quando você percebeu o problema pela primeira vez? (ex: 18/10/2025)";

    case 8:
      if (!isValidDate(msg.body.trim())) {
        return "Escreva a data no formato dia/mês/ano (ex: 18/10/2025).";
      }
      userState.date = msg.body.trim();
      userState.step++;
      return "Agora, por favor, descreva detalhadamente o problema em suas próprias palavras.";

    case 9:
      userState.description = msg.body.trim();
      userState.step++;
      return "Deseja enviar alguma imagem ou vídeo? (sim/não)";

    case 10:
      if (text === "sim") {
        userState.step = 11;
        return "Envie sua imagem ou vídeo.";
      } else if (text === "não" || text === "nao") {
        userState.step = 12;
        return "Sua demanda está prestes a ser enviada. Deseja mudar algo? (sim/não)";
      } else {
        return "Responda apenas com 'sim' ou 'não'.";
      }

    case 11:
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        userState.media = media;
        console.log(media);
        userState.step = 12;
        return "Recebi sua mídia. Deseja mudar algo antes de enviar? (sim/não)";
      }
      return "Por favor, envie a imagem ou vídeo.";

    case 12:
      if (text === "sim") {
        userState.step = 13;
        userState.editingField = null;
        return `O que deseja alterar?
      - Tipo do problema
      - Endereço
      - Data
      - Descrição
      - Mídias`;
      } else if (text === "não" || text === "nao") {
        userState.step = 14;

        const secretaria = await classifySecretaria(userState.description);
        if (secretaria == "error")
          return "Um erro inesperado aconteceu, tente novamente mais tarde";

        userState.secretaria = secretaria;

        return `Sua demanda foi enviada para *${secretaria}*.\n\nResumo:
      \n🧍 Nome: ${userState.name}
      \n📋 Tipo: ${userState.problemType}
      \n📍 Endereço: ${userState.address || "Não informado"}
      \n📅 Data: ${userState.date}
      \n📝 Descrição: ${userState.description}
      \n🏛️ Secretaria: ${secretaria}`;
      } else {
        return "Responda apenas com 'sim' ou 'não'.";
      }

    case 13:
      // Se ainda não escolheu o campo para alterar
      if (!userState.editingField) {
        const option = text;

        if (
          [
            "tipo do problema",
            "endereço",
            "data",
            "descrição",
            "mídias",
          ].includes(option)
        ) {
          userState.editingField = option;
          // Redireciona para o campo escolhido
          switch (option) {
            case "tipo do problema":
              return "Digite o novo tipo do problema:";
            case "endereço":
              return "Digite o novo endereço:";
            case "data":
              return "Digite a nova data (ex: 18/10/2025):";
            case "descrição":
              return "Digite a nova descrição:";
            case "mídias":
              userState.step = 11; // volta pro envio de mídia
              userState.editingField = null;
              return "Envie sua nova imagem ou vídeo.";
          }
        } else {
          return "Escolha uma das opções válidas: Tipo do problema, Endereço, Data, Descrição ou Mídias.";
        }
      }

      // Se já escolheu o campo, atualiza de fato o valor
      const newValue = msg.body.trim();
      switch (userState.editingField) {
        case "tipo do problema":
          userState.problemType = newValue;
          break;
        case "endereço":
          userState.address = newValue;
          break;
        case "data":
          if (!isValidDate(newValue)) {
            return "Escreva a data no formato dia/mês/ano (ex: 18/10/2025).";
          }
          userState.date = newValue;
          break;
        case "descrição":
          userState.description = newValue;
          break;
      }

      // Limpa o campo e volta pro menu de confirmação
      userState.editingField = null;
      userState.step = 12;
      return `✅ ${
        userState.editingField ?? "Informação"
      } alterada com sucesso. Deseja mudar mais algo? (sim/não)`;

    default:
      return "Digite *começar* para iniciar uma nova demanda.";
  }
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true },
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("📱 Escaneie o QR code com seu WhatsApp");
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado e pronto!");
});

client.on("message", async (msg) => {
  if (msg.from.includes("@g.us")) return;

  const text = msg.body.trim().toLowerCase();

  if (text === "cancelar") {
    const userState = userStates.get(msg.from);
    if (userState && userState.timeout) {
      clearTimeout(userState.timeout);
    }
    userStates.delete(msg.from);
    await client.sendMessage(
      msg.from,
      "✅ Sua demanda foi cancelada. Se quiser, pode digitar *começar* para iniciar uma nova demanda."
    );
    return;
  }

  if (initMsgPossibilites.includes(text)) {
    const existingState = userStates.get(msg.from);
    if (existingState) return;
    client.sendMessage(
      msg.from,
      "Olá, bem vindo ao Resolve Já. Para começar uma nova demanda escreva *começar*."
    );
    return;
  }

  if (text === "começar" || text == "comecar") {
    const existingState = userStates.get(msg.from);

    if (existingState && existingState.step < 14) {
      await client.sendMessage(
        msg.from,
        "❌ Você já iniciou uma demanda. Por favor, conclua antes de iniciar outro. Ou escreva *cancelar* para cancelar a demanda atual"
      );
      return;
    }

    userStates.set(msg.from, { step: 1, timeout: null });
    await client.sendMessage(
      msg.from,
      "Antes de começar, deseja se identificar? (sim/não)"
    );
    return;
  }

  const userState = userStates.get(msg.from);
  if (userState) {
    resetUserTimer(msg.from);

    const reply = await handleQuestionnaire(msg, userState, client);
    if (reply) await client.sendMessage(msg.from, reply);
  } else {
    await client.sendMessage(
      msg.from,
      "Digite *começar* para iniciar o atendimento do Resolve Já."
    );
  }
});

client.initialize();
