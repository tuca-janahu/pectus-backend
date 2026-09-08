import type { ActivationEmailInput, Mailer, PasswordResetEmailInput } from "./mailer";

export class NoopMailer implements Mailer {
  async sendActivationEmail(input: ActivationEmailInput) {
    console.warn(`[email] RESEND_API_KEY não configurada - e-mail de ativação não enviado para ${input.to}`);
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    console.warn(
      `[email] RESEND_API_KEY não configurada - e-mail de redefinição de senha não enviado para ${input.to}`,
    );
  }
}
