import express from "express";
import authRouter from "./modules/auth/auth.routes";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok, pectus rodando" });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
