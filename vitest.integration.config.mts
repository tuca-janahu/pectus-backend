import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    // Todos os arquivos compartilham o mesmo banco de teste e fazem deleteMany()
    // em massa no afterEach — rodar em paralelo causa violacoes de FK/unique
    // entre arquivos concorrentes.
    fileParallelism: false,
  },
});
