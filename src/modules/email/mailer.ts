export interface ActivationEmailInput {
  to: string;
  nome: string;
  activationLink: string;
  expiresAt: Date;
}

export interface PasswordResetEmailInput {
  to: string;
  nome: string;
  resetLink: string;
  expiresAt: Date;
}

export interface Mailer {
  sendActivationEmail(input: ActivationEmailInput): Promise<void>;
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;
}
