import { Resend } from "resend";
import { emailConfig } from "../../config/email";
import type { ActivationEmailInput, Mailer, PasswordResetEmailInput } from "./mailer";

function formatExpiry(date: Date) {
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string = emailConfig.resendApiKey,
    private readonly from: string = emailConfig.emailFrom,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendActivationEmail({ to, nome, activationLink, expiresAt }: ActivationEmailInput) {
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Ative sua conta Pectus",
      html: `
        <p>Olá, ${nome},</p>
        <p>Sua conta na Pectus foi criada. Clique no link abaixo para definir sua senha e ativar o acesso:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p>Este link expira em ${formatExpiry(expiresAt)}.</p>
        <p>Se você não esperava este e-mail, ignore-o.</p>
      `,
    });
    if (error) throw new Error(error.message);
  }

  async sendPasswordResetEmail({ to, nome, resetLink, expiresAt }: PasswordResetEmailInput) {
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Redefinição de senha - Pectus",
      html: `
        <p>Olá, ${nome},</p>
        <p>Recebemos uma solicitação para redefinir sua senha na Pectus. Clique no link abaixo para criar uma nova senha:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este link expira em ${formatExpiry(expiresAt)}.</p>
        <p><strong>Se você não solicitou esta alteração, ignore este e-mail - sua senha atual continua válida.</strong></p>
      `,
    });
    if (error) throw new Error(error.message);
  }
}
