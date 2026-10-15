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

  async criarEventoParaFicha(fichaId: number): Promise<string | null> {
    try {
      const ficha = await prisma.fichaEpicritica.findUnique({
        where: { id: fichaId },
        include: {
          paciente: { select: { id: true, nome: true } },
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

      if (!ficha) {
        console.warn(`[GoogleCalendarService] Ficha #${fichaId} não encontrada.`);
        return null;
      }

      if (ficha.googleEventId) {
        console.log(
          `[GoogleCalendarService] Ficha #${fichaId} já possui evento no Google Calendar (${ficha.googleEventId}).`,
        );
        return ficha.googleEventId;
      }

      const calendar = await this.getAuthenticatedCalendar(ficha.medico.contaId);
      if (!calendar) {
        console.info(
          `[GoogleCalendarService] Médico #${ficha.medico.id} (${ficha.medico.conta.nome}) não possui Google Calendar conectado. Evento não sincronizado.`,
        );
        return null;
      }

      const inicio = new Date(ficha.dataHoraPrevista);
      const termino = calcularDataTermino(inicio, DEFAULT_APPOINTMENT_DURATION_MINUTES);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const linkFicha = `${frontendUrl}/fichas/${ficha.id}`;

      const detalhes = [
        `Paciente: ${ficha.paciente.nome}`,
        `Médico: ${ficha.medico.conta.nome} (CRM: ${ficha.medico.crm})`,
        ficha.procedimento ? `Procedimento: ${ficha.procedimento}` : null,
        ficha.observacoes ? `Observações: ${ficha.observacoes}` : null,
        `Prontuário no sistema: ${linkFicha}`,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Consulta: ${ficha.paciente.nome} - Traque Med`,
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
        await prisma.fichaEpicritica.update({
          where: { id: fichaId },
          data: { googleEventId },
        });

        console.info(
          `[GoogleCalendarService] Evento criado no Google Calendar para Ficha #${fichaId} (Event ID: ${googleEventId}).`,
        );
      }

      return googleEventId;
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao sincronizar criação da Ficha #${fichaId} com Google Calendar:`,
        error,
      );
      return null;
    }
  }

  async atualizarEventoParaFicha(fichaId: number): Promise<void> {
    try {
      const ficha = await prisma.fichaEpicritica.findUnique({
        where: { id: fichaId },
        include: {
          paciente: { select: { id: true, nome: true } },
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

      if (!ficha) return;

      if (!ficha.googleEventId) {
        await this.criarEventoParaFicha(fichaId);
        return;
      }

      const calendar = await this.getAuthenticatedCalendar(ficha.medico.contaId);
      if (!calendar) return;

      const inicio = new Date(ficha.dataHoraPrevista);
      const termino = calcularDataTermino(inicio, DEFAULT_APPOINTMENT_DURATION_MINUTES);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const linkFicha = `${frontendUrl}/fichas/${ficha.id}`;

      const detalhes = [
        `Paciente: ${ficha.paciente.nome}`,
        `Médico: ${ficha.medico.conta.nome} (CRM: ${ficha.medico.crm})`,
        ficha.procedimento ? `Procedimento: ${ficha.procedimento}` : null,
        ficha.observacoes ? `Observações: ${ficha.observacoes}` : null,
        `Prontuário no sistema: ${linkFicha}`,
      ]
        .filter(Boolean)
        .join("\n");

      await calendar.events.patch({
        calendarId: "primary",
        eventId: ficha.googleEventId,
        requestBody: {
          summary: `Consulta: ${ficha.paciente.nome} - Traque Med`,
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
        `[GoogleCalendarService] Evento atualizado no Google Calendar para Ficha #${fichaId} (Event ID: ${ficha.googleEventId}).`,
      );
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao atualizar evento da Ficha #${fichaId} no Google Calendar:`,
        error,
      );
    }
  }

  async removerEventoParaFicha(fichaId: number): Promise<void> {
    try {
      const ficha = await prisma.fichaEpicritica.findUnique({
        where: { id: fichaId },
        include: {
          medico: {
            select: {
              id: true,
              contaId: true,
            },
          },
        },
      });

      if (!ficha || !ficha.googleEventId) return;

      const calendar = await this.getAuthenticatedCalendar(ficha.medico.contaId);
      if (!calendar) return;

      await calendar.events.delete({
        calendarId: "primary",
        eventId: ficha.googleEventId,
      });

      await prisma.fichaEpicritica.update({
        where: { id: fichaId },
        data: { googleEventId: null },
      });

      console.info(
        `[GoogleCalendarService] Evento removido do Google Calendar para Ficha #${fichaId} (Event ID: ${ficha.googleEventId}).`,
      );
    } catch (error) {
      console.error(
        `[GoogleCalendarService] Erro ao remover evento da Ficha #${fichaId} no Google Calendar:`,
        error,
      );
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
