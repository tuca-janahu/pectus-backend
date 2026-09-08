const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function formatExpiry(date: Date): string {
  return date.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

interface EmailLayoutInput {
  previewText: string;
  eyebrow: string;
  title: string;
  greetingName: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaLink: string;
  expiresAt: Date;
  noticeText: string;
}

function emailLayout({
  previewText,
  eyebrow,
  title,
  greetingName,
  paragraphs,
  ctaLabel,
  ctaLink,
  expiresAt,
  noticeText,
}: EmailLayoutInput): string {
  const paragraphsHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d4451;">${paragraph}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${title}</title>
    <!--[if mso]>
    <style>table {border-collapse: collapse;}</style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#eef1f5;-webkit-text-size-adjust:100%;font-family:${FONT_STACK};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ec;">
            <tr>
              <td style="background-color:#18456d;background-image:linear-gradient(135deg,#2f86d3,#18456d);padding:28px 32px;">
                <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">Pectus</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.82);margin-top:2px;">Acompanhamento de traqueoplastias</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#2f86d3;margin-bottom:10px;">${eyebrow}</div>
                <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:#1f2430;">${title}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d4451;">Olá, ${greetingName},</p>
                ${paragraphsHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;" align="center">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#2f86d3;">
                      <a href="${ctaLink}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#93a0b0;word-break:break-all;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a href="${ctaLink}" style="color:#2f86d3;text-decoration:underline;">${ctaLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf3e0;border:1px solid #f0d9a8;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#8a5a12;">
                      <strong>Este link expira em ${formatExpiry(expiresAt)}.</strong> ${noticeText}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e3e7ec;margin:0 0 20px;" />
                <p style="margin:0;font-size:12px;line-height:1.6;color:#93a0b0;">
                  Este é um e-mail automático do sistema Pectus. Se você não reconhece esta solicitação, pode
                  ignorar esta mensagem com segurança — nenhuma ação será tomada.
                </p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:20px 12px 0;">
                <p style="margin:0;font-size:11.5px;color:#a7b0bd;">
                  © ${new Date().getFullYear()} Pectus · Sistema de acompanhamento de traqueoplastias
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderActivationEmail(input: { nome: string; activationLink: string; expiresAt: Date }) {
  return {
    subject: "Ative sua conta Pectus",
    html: emailLayout({
      previewText: "Sua conta na Pectus foi criada. Defina sua senha para ativar o acesso.",
      eyebrow: "Ativação de conta",
      title: "Sua conta foi criada",
      greetingName: input.nome,
      paragraphs: [
        "Sua conta na <strong>Pectus</strong> foi criada pela administração da clínica. Para começar a usar o " +
          "sistema, defina uma senha de acesso clicando no botão abaixo.",
      ],
      ctaLabel: "Definir senha e ativar conta",
      ctaLink: input.activationLink,
      expiresAt: input.expiresAt,
      noticeText: "Depois desse prazo, será necessário solicitar um novo link ao administrador da clínica.",
    }),
  };
}

export function renderPasswordResetEmail(input: { nome: string; resetLink: string; expiresAt: Date }) {
  return {
    subject: "Redefinição de senha - Pectus",
    html: emailLayout({
      previewText: "Recebemos uma solicitação para redefinir sua senha na Pectus.",
      eyebrow: "Redefinição de senha",
      title: "Redefina sua senha",
      greetingName: input.nome,
      paragraphs: [
        "Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Pectus</strong>. Clique no " +
          "botão abaixo para criar uma nova senha.",
        "<strong>Se você não solicitou esta alteração, ignore este e-mail — sua senha atual continua válida.</strong>",
      ],
      ctaLabel: "Redefinir senha",
      ctaLink: input.resetLink,
      expiresAt: input.expiresAt,
      noticeText: "Depois desse prazo, será necessário solicitar um novo link na tela de recuperação de senha.",
    }),
  };
}
