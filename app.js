import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { classifySecretaria } from "./classifier.js";

const { Client, LocalAuth } = pkg;
// 🧠 Estados das conversas por usuário
const userStates = new Map();

// 📋 Mensagens de boas-vindas aceitas
const initMsgPossibilites = [
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
];

// 🔍 Validações auxiliares
const isValidCPF = (cpf) => {
  const regex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
  return regex.test(cpf);
};

const isValidDate = (date) => {
  const regex = /^([0-2]\d|3[0-1])\/(0\d|1[0-2])\/\d{4}$/;
  return regex.test(date);
};

// 💬 Fluxo principal do questionário
async function handleQuestionnaire(msg, userState, client) {
  const text = msg.body.trim().toLowerCase();

  switch (userState.step) {
    case 0:
      userState.step++;
      console.log(userState.step);
      return "Antes de começar, deseja se identificar? (sim/não)";
    case 1:
      if (text === "sim") {
        userState.step = 2;
        userState.identified = true;
        return "Certo! Escreva seu nome:";
      } else if (text === "não" || text === "nao") {
        console.log("Entrou no modo anonimo");
        userState.step = 5;
        userState.identified = false;
        userState.name = "Anônimo";
        return "Tudo bem. Vamos continuar.\nPrimeiro, defina em poucas palavras o tipo do problema (ex: buraco, iluminação, lixo, árvore, saúde)";
      } else {
        return "Por favor, responda apenas com 'sim' ou 'não'.";
      }

    case 2:
      console.log("Entrou no case 2");
      userState.name = msg.body.trim();
      userState.step++;
      return "Digite o seu CPF:";

    case 3:
      console.log("Entrou no case 3");
      if (!isValidCPF(msg.body.trim())) {
        return "Escreva o CPF apenas em números ou no formato 000.000.000-00 e tente novamente:";
      }
      userState.cpf = msg.body.trim();
      userState.step = 5;
      return "Perfeito! Agora, defina em poucas palavras o tipo do problema (ex: buraco, iluminação, lixo, árvore, saúde)";

    case 5:
      console.log("Entrou no case 5");
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
        console.log(msg.body.trim());
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
        userState.step = 12;
        return "Recebi sua mídia. Deseja mudar algo antes de enviar? (sim/não)";
      }
      return "Por favor, envie a imagem ou vídeo.";

    case 12:
      if (text === "sim") {
        userState.step = 13;
        userState.editingField = null; // novo controle
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
      // 1️⃣ Se ainda não escolheu o campo para alterar
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

      // 2️⃣ Se já escolheu o campo, atualiza de fato o valor
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

// 🚀 Inicializa o cliente do WhatsApp
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
  const text = msg.body.trim().toLowerCase();

  // 🔴 Cancelar demanda a qualquer momento
  if (text === "cancelar") {
    userStates.delete(msg.from);
    await client.sendMessage(
      msg.from,
      "✅ Sua demanda foi cancelada. Se quiser, pode digitar *começar* para iniciar uma nova demanda."
    );
    return;
  }

  // Verifica se é uma saudação
  if (initMsgPossibilites.includes(text)) {
    client.sendMessage(
      msg.from,
      "Olá, bem vindo ao Resolve Já. Para começar uma nova demanda escreva *começar*."
    );
    return;
  }

  // Inicia o questionário
  if (text === "começar") {
    userStates.set(msg.from, { step: 1 });
    client.sendMessage(
      msg.from,
      "Antes de começar, deseja se identificar? (sim/não)"
    );
    return;
  }

  // Continua o fluxo
  const userState = userStates.get(msg.from);
  if (userState) {
    const reply = await handleQuestionnaire(msg, userState, client);
    if (reply) await client.sendMessage(msg.from, reply);
  } else {
    await client.sendMessage(
      msg.from,
      "Digite *oi* para iniciar o atendimento do Resolve Já."
    );
  }
});

client.initialize();
