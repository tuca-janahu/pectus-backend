import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";

const NOME_CAMPO: Record<string, string> = {
  cpf: "CPF",
  email: "e-mail",
  crm: "CRM",
};

const CAMPOS_CONHECIDOS = Object.keys(NOME_CAMPO);

function nomeCampo(campo: string): string {
  return NOME_CAMPO[campo] ?? campo;
}

// O formato de `error.meta` para P2002 varia conforme o driver do Prisma: com o
// adapter-pg usado neste projeto, não vem um `target` com o nome do campo - vem o
// nome da constraint do Postgres (ex: "pacientes_cpf_key") dentro de
// `driverAdapterError.cause.constraint.index`. Por isso checamos as duas formas
// possíveis em vez de confiar só em `target`.
function campoDoConflito(meta: unknown): string | undefined {
  const alvo = (meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(alvo) && typeof alvo[0] === "string") return alvo[0];
  if (typeof alvo === "string") return alvo;

  const nomeRestricao = (
    meta as { driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } } | undefined
  )?.driverAdapterError?.cause?.constraint?.index;
  if (typeof nomeRestricao === "string") {
    return CAMPOS_CONHECIDOS.find((campo) => nomeRestricao.includes(campo));
  }

  return undefined;
}

/**
 * Converte qualquer erro lançado no backend numa mensagem segura para expor ao
 * cliente (nunca vaza detalhes internos de Prisma/stack/etc.) e loga o erro
 * original no console sempre que a causa real não é óbvia a partir da mensagem
 * devolvida. Único ponto de conversão erro -> mensagem usado por todos os
 * controllers, pra não repetir (e divergir) essa lógica em cada um.
 */
export function mensagemDeErro(error: unknown, fallback = "Erro interno. Tente novamente."): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const campo = campoDoConflito(error.meta);
        return campo ? `Já existe um registro com esse ${nomeCampo(campo)}.` : "Já existe um registro com esses dados.";
      }
      case "P2025":
        return "Registro não encontrado.";
      case "P2003":
        return "Não é possível concluir a operação: há dados relacionados a esse registro.";
      default:
        console.error("Erro do Prisma não mapeado:", error);
        return fallback;
    }
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }

  if (error instanceof Error) {
    // Erros lançados deliberadamente pelos nossos serviços (new Error("mensagem em
    // português", já pensada para ser exibida) passam direto. Qualquer outra
    // subclasse de Error (bug inesperado, erro de lib não mapeado acima) não deve
    // vazar detalhes internos - só o literal `new Error(...)` é considerado seguro.
    if (error.constructor === Error) return error.message;
    console.error("Erro inesperado:", error);
    return fallback;
  }

  console.error("Erro desconhecido:", error);
  return fallback;
}
