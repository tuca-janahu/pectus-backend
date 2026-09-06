import { emailConfig } from "../../config/email";
import type { Mailer } from "./mailer";
import { NoopMailer } from "./noop-mailer";
import { ResendMailer } from "./resend-mailer";

export type { ActivationEmailInput, Mailer, PasswordResetEmailInput } from "./mailer";
export { NoopMailer } from "./noop-mailer";
export { ResendMailer } from "./resend-mailer";

if (!emailConfig.resendApiKey) {
  console.warn("RESEND_API_KEY nao definida - e-mails serao apenas logados no console (NoopMailer).");
}

export const mailer: Mailer = emailConfig.resendApiKey ? new ResendMailer() : new NoopMailer();
