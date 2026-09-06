import type { ActivationEmailInput, Mailer, PasswordResetEmailInput } from "./mailer";

export class NoopMailer implements Mailer {
  async sendActivationEmail(input: ActivationEmailInput) {
    console.warn(`[email] RESEND_API_KEY nao configurada - e-mail de ativacao nao enviado para ${input.to}`);
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    console.warn(
      `[email] RESEND_API_KEY nao configurada - e-mail de redefinicao de senha nao enviado para ${input.to}`,
    );
  }
}
