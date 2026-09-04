import "dotenv/config";
import { prisma } from "../src/db/prisma";
import { PrismaContaRepository } from "../src/modules/contas/conta.repository";
import { RegisterService } from "../src/modules/contas/register.service";

async function main() {
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();

  if (!name || !email) {
    throw new Error("INITIAL_ADMIN_NAME e INITIAL_ADMIN_EMAIL sao obrigatorias.");
  }

  const existing = await prisma.conta.findUnique({ where: { email } });
  if (!existing) {
    const service = new RegisterService(new PrismaContaRepository(prisma));
    const { activationToken } = await service.execute({ nome: name, email, roles: ["ADMIN"] });
    console.log(`ADMIN inicial criado. Token de ativacao: ${activationToken}`);
  } else {
    console.log("ADMIN inicial ja existe.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
