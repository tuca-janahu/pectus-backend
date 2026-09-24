import "dotenv/config";
import cors from "cors";
import express from "express";
import authRouter from "./modules/auth/auth.routes";
import contasRouter from "./modules/contas/contas.routes";
import localidadesRouter from "./modules/localidades/localidades.routes";
import pacientesRouter from "./modules/pacientes/pacientes.routes";

const app = express();
const port = Number(process.env.PORT) || 3000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/auth", authRouter);
app.use("/contas", contasRouter);
app.use("/localidades", localidadesRouter);
app.use("/pacientes", pacientesRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
