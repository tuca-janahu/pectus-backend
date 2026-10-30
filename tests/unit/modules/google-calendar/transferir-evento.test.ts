import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/db/prisma", () => ({
  prisma: { atendimento: { updateMany: vi.fn() } },
}));

import { prisma } from "../../../../src/db/prisma";
import { GoogleCalendarService } from "../../../../src/modules/google-calendar/google-calendar.service";

describe("transferência de evento do Google Calendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("remove do calendário anterior antes de criar no novo", async () => {
    const service = new GoogleCalendarService();
    const remover = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(service, "getAuthenticatedCalendar", { value: vi.fn().mockResolvedValue({ events: { delete: remover } }) });
    const criar = vi.spyOn(service, "criarEventoParaAtendimento").mockResolvedValue("novo-evento");
    vi.mocked(prisma.atendimento.updateMany).mockResolvedValue({ count: 1 });

    await service.transferirEventoParaAtendimento(10, 20, "evento-antigo");

    expect(remover).toHaveBeenCalledWith({ calendarId: "primary", eventId: "evento-antigo" });
    expect(prisma.atendimento.updateMany).toHaveBeenCalledWith({
      where: { id: 10, googleEventId: "evento-antigo" }, data: { googleEventId: null },
    });
    expect(criar).toHaveBeenCalledWith(10);
  });

  it("não cria evento novo quando o calendário anterior está indisponível", async () => {
    const service = new GoogleCalendarService();
    Object.defineProperty(service, "getAuthenticatedCalendar", { value: vi.fn().mockResolvedValue(null) });
    const criar = vi.spyOn(service, "criarEventoParaAtendimento").mockResolvedValue("novo-evento");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await service.transferirEventoParaAtendimento(10, 20, "evento-antigo");
      expect(prisma.atendimento.updateMany).not.toHaveBeenCalled();
      expect(criar).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("recupera transferência quando o evento antigo já foi removido", async () => {
    const service = new GoogleCalendarService();
    Object.defineProperty(service, "getAuthenticatedCalendar", { value: vi.fn().mockResolvedValue({
      events: { delete: vi.fn().mockRejectedValue({ code: 404 }) },
    }) });
    const criar = vi.spyOn(service, "criarEventoParaAtendimento").mockResolvedValue("novo-evento");
    vi.mocked(prisma.atendimento.updateMany).mockResolvedValue({ count: 1 });

    await service.transferirEventoParaAtendimento(10, 20, "evento-antigo");

    expect(prisma.atendimento.updateMany).toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith(10);
  });
});
