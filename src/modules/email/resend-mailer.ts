import { Resend } from "resend";
import { emailConfig } from "../../config/email";
import type { ActivationEmailInput, Mailer, PasswordResetEmailInput } from "./mailer";
import { renderActivationEmail, renderPasswordResetEmail } from "./templates";

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string = emailConfig.resendApiKey,
    private readonly from: string = emailConfig.emailFrom,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendActivationEmail({ to, nome, activationLink, expiresAt }: ActivationEmailInput) {
    const { subject, html } = renderActivationEmail({ nome, activationLink, expiresAt });
    const { error } = await this.client.emails.send({ from: this.from, to, subject, html });
    if (error) throw new Error(error.message);
  }

  async sendPasswordResetEmail({ to, nome, resetLink, expiresAt }: PasswordResetEmailInput) {
    const { subject, html } = renderPasswordResetEmail({ nome, resetLink, expiresAt });
    const { error } = await this.client.emails.send({ from: this.from, to, subject, html });
    if (error) throw new Error(error.message);
  }
}
