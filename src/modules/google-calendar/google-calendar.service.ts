import { google } from "googleapis";
import { prisma } from "../../db/prisma";

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

export function calcularDataTermino(
  inicio: Date,
  duracaoMinutos = DEFAULT_APPOINTMENT_DURATION_MINUTES,
): Date {
  return new Date(inicio.getTime() + duracaoMinutos * 60 * 1000);
}

export class GoogleCalendarService {
  private getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, "postmessage");
  }

  async salvarTokens(
    contaId: number,
    tokens: {
      refresh_token?: string | null;
      access_token?: string | null;
      expiry_date?: number | null;
      scope?: string | null;
    },
  ): Promise<void> {
    if (!tokens.refresh_token && !tokens.access_token) return;

    await prisma.googleCalendarToken.upsert({
      where: { contaId },
      create: {
        contaId,
        refreshToken: tokens.refresh_token ?? "",
        accessToken: tokens.access_token ?? null,
        expiraEm: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        escopo: tokens.scope ?? null,
      },
      update: {
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
        ...(tokens.expiry_date ? { expiraEm: new Date(tokens.expiry_date) } : {}),
        ...(tokens.scope ? { escopo: tokens.scope } : {}),
      },
    });
  }

  async conectarComCode(contaId: number, code: string): Promise<void> {
    const oauth2Client = this.getOAuth2Client();
    if (!oauth2Client) {
      throw new Error("Credenciais do Google não configuradas no servidor.");
    }

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      const existente = await prisma.googleCalendarToken.findUnique({ where: { contaId } });
      if (!existente?.refreshToken) {
        throw new Error(
          "Não foi retornado refresh_token pelo Google. Certifique-se de solicitar acesso offline com consentimento.",
        );
      }
    }

    await this.salvarTokens(contaId, tokens);
  }

  private async getAuthenticatedCalendar(contaId: number) {
    const oauth2Client = this.getOAuth2Client();
    if (!oauth2Client) {
      console.warn(
        `[GoogleCalendarService] GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET ausentes no ambiente.`,
      );
      return null;
    }

    const tokenRecord = await prisma.googleCalendarToken.findUnique({
      where: { contaId },
    });

    if (!tokenRecord || !tokenRecord.refreshToken) {
      return null;
    }

    oauth2Client.setCredentials({
      refresh_token: tokenRecord.refreshToken,
      access_token: tokenRecord.accessToken ?? undefined,
    });

    oauth2Client.on("tokens", async (newTokens) => {
      try {
        await this.salvarTokens(contaId, newTokens);
      } catch (err) {
        console.error(
          `[GoogleCalendarService] Falha ao atualizar tokens da conta #${contaId}:`,
          err,
        );
      }
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  async criarEventoParaAtendimento(atendimentoId: number): Promise<string | null> {
    try {
      const atendimento = await prisma.atendimento.findUnique({
        where: { id: atendimentoId },
        include: {
          ficha: { include: { paciente: { select: { id: true, nome: true } } } },
          medico: {
            select: {
              id: true,
              crm: true,
              contaId: true,
              conta: { select: { id: true, nome: true, email: true } },
            },
          },
        },
      });

      if (!atendimento) {
        console.warn(`[GoogleCalendarService] Atendimento #${atendimentoId} não encontrada.`);
        return null;
      }

      if (atendimento.googleEventId) {
        console.log(
          `[GoogleCalendarService] Atendimento #${atendimentoId} já possui evento no Google Calendar (${atendimento.googleEventId}).`,
        );
        return atendimento.googleEventId;
      }

      const calendar = await this.getAuthenticatedCalendar(atendimento.medico.contaId);
      if (!calendar) {
        console.info(
          `[GoogleCalendarService] Médico #${atendimento.medico.id} (${atendimento.medico.conta.nome}) não possui Google Calendar conectado. Evento não sincronizado.`,
        );
        return null;
      }

      const inicio = new Date(atendimento.dataHoraPrevista);
      const termino = calcularDataTermino(inicio, DEFAULT_APPOINTMENT_DURATION_MINUTES);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const linkAtendimento = `${frontendUrl}/atendimentos/${atendimento.id}/editar`;

      const detalhes = [
        `Paciente: ${atendimento.ficha.paciente.nome}`,
        `Médico: ${atendimento.medico.conta.nome} (CRM: ${atendimento.medico.crm})`,
        atendimento.procedimento ? `Procedimento: ${atendimento.procedimento}` : null,
        atendimento.observacoes ? `Observações: ${atendimento.observacoes}` : null,
        `Prontuário no sistema: ${linkAtendimento}`,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Consulta: ${atendimento.ficha.paciente.nome} - Traque Med`,
          description: detalhes,
          start: {
            dateTime: inicio.toISOString(),
          },
          end: {
            dateTime: termino.toISOString(),
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "email", minutes: 60 },
            ],
          },
        },
      });

      const googleEventId = response.data.id ?? null;

      if (googleEventId) {
        await prisma.atendimento.update({
          where: { id: atendimentoId },
          data: { googleEventId },
        });

        console.info(
          `[GoogleCalendarService] Evento criado no Google Calendar para Atendimento #${atendimentoId} (Event ID: ${googleEventId}).`,
        );
      }

      return googleEventId;
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao sincronizar criação da Atendimento #${atendimentoId} com Google Calendar:`,
        error,
      );
      return null;
    }
  }

  async atualizarEventoParaAtendimento(atendimentoId: number): Promise<void> {
    try {
      const atendimento = await prisma.atendimento.findUnique({
        where: { id: atendimentoId },
        include: {
          ficha: { include: { paciente: { select: { id: true, nome: true } } } },
          medico: {
            select: {
              id: true,
              crm: true,
              contaId: true,
              conta: { select: { id: true, nome: true } },
            },
          },
        },
      });

      if (!atendimento) return;

      if (!atendimento.googleEventId) {
        await this.criarEventoParaAtendimento(atendimentoId);
        return;
      }

      const calendar = await this.getAuthenticatedCalendar(atendimento.medico.contaId);
      if (!calendar) return;

      const inicio = new Date(atendimento.dataHoraPrevista);
      const termino = calcularDataTermino(inicio, DEFAULT_APPOINTMENT_DURATION_MINUTES);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const linkAtendimento = `${frontendUrl}/atendimentos/${atendimento.id}/editar`;

      const detalhes = [
        `Paciente: ${atendimento.ficha.paciente.nome}`,
        `Médico: ${atendimento.medico.conta.nome} (CRM: ${atendimento.medico.crm})`,
        atendimento.procedimento ? `Procedimento: ${atendimento.procedimento}` : null,
        atendimento.observacoes ? `Observações: ${atendimento.observacoes}` : null,
        `Prontuário no sistema: ${linkAtendimento}`,
      ]
        .filter(Boolean)
        .join("\n");

      await calendar.events.patch({
        calendarId: "primary",
        eventId: atendimento.googleEventId,
        requestBody: {
          summary: `Consulta: ${atendimento.ficha.paciente.nome} - Traque Med`,
          description: detalhes,
          start: {
            dateTime: inicio.toISOString(),
          },
          end: {
            dateTime: termino.toISOString(),
          },
        },
      });

      console.info(
        `[GoogleCalendarService] Evento atualizado no Google Calendar para Atendimento #${atendimentoId} (Event ID: ${atendimento.googleEventId}).`,
      );
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao atualizar evento da Atendimento #${atendimentoId} no Google Calendar:`,
        error,
      );
    }
  }

  async transferirEventoParaAtendimento(atendimentoId: number, contaAnteriorId: number, eventoAnteriorId: string | null): Promise<void> {
    try {
      if (eventoAnteriorId) {
        const calendarioAnterior = await this.getAuthenticatedCalendar(contaAnteriorId);
        if (!calendarioAnterior) {
          console.error(`[GoogleCalendarService] Calendário anterior indisponível para transferir atendimento #${atendimentoId}.`);
          return;
        }
        try {
          await calendarioAnterior.events.delete({ calendarId: "primary", eventId: eventoAnteriorId });
        } catch (error) {
          const resposta = error as { code?: number; response?: { status?: number } };
          if (resposta.code !== 404 && resposta.response?.status !== 404) throw error;
        }
        await prisma.atendimento.updateMany({
          where: { id: atendimentoId, googleEventId: eventoAnteriorId },
          data: { googleEventId: null },
        });
      }
      await this.criarEventoParaAtendimento(atendimentoId);
    } catch (error) {
      console.error(`[GoogleCalendarService] Erro ao transferir evento do atendimento #${atendimentoId}:`, error);
    }
  }

  async removerEventoParaAtendimento(atendimentoId: number): Promise<void> {
    try {
      const atendimento = await prisma.atendimento.findUnique({
        where: { id: atendimentoId },
        include: {
          medico: {
            select: {
              id: true,
              contaId: true,
            },
          },
        },
      });

      if (!atendimento || !atendimento.googleEventId) return;

      const calendar = await this.getAuthenticatedCalendar(atendimento.medico.contaId);
      if (!calendar) return;

      await calendar.events.delete({
        calendarId: "primary",
        eventId: atendimento.googleEventId,
      });

      await prisma.atendimento.update({
        where: { id: atendimentoId },
        data: { googleEventId: null },
      });

      console.info(
        `[GoogleCalendarService] Evento removido do Google Calendar para Atendimento #${atendimentoId} (Event ID: ${atendimento.googleEventId}).`,
      );
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao remover evento da Atendimento #${atendimentoId} no Google Calendar:`,
        error,
      );
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
