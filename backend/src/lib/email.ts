import nodemailer from 'nodemailer';

// Email configuration
const createTransporter = () => {
  // Use SMTP settings from environment variables
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  // Detailed diagnostic logging
  console.log('[Email] SMTP Configuration:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  Secure: ${port === 465}`);
  console.log(`  User: ${user ? '✓ Set' : '✗ Not set'}`);
  console.log(`  Pass: ${pass ? '✓ Set (length: ' + pass.length + ')' : '✗ Not set'}`);
  console.log(`  From: ${from || 'Not set'}`);

  if (!user || !pass) {
    console.error('[Email] ❌ SMTP credentials not configured!');
    console.error('[Email] Set SMTP_USER and SMTP_PASS environment variables.');
    console.error('[Email] Current env vars:', {
      SMTP_HOST: process.env.SMTP_HOST || 'not set',
      SMTP_PORT: process.env.SMTP_PORT || 'not set',
      SMTP_USER: process.env.SMTP_USER ? 'set' : 'NOT SET',
      SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'NOT SET',
      SMTP_FROM: process.env.SMTP_FROM || 'not set',
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: user && pass ? { user, pass } : undefined,
    logger: true, // Enable nodemailer logging
    debug: true, // Enable debug output
  });
};

export async function sendPasswordResetEmail(email: string, token: string, firstName: string) {
  const transporter = createTransporter();
  
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3005'}/reset-password?token=${token}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          padding: 40px;
          color: white;
        }
        .content {
          background: white;
          border-radius: 12px;
          padding: 32px;
          margin-top: 24px;
          color: #333;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          margin: 24px 0;
        }
        .footer {
          text-align: center;
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          margin-top: 24px;
        }
        .warning {
          background: rgba(251, 191, 36, 0.1);
          border-left: 4px solid #fbbf24;
          padding: 16px;
          margin-top: 16px;
          border-radius: 8px;
          font-size: 14px;
          color: #92400e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800;">🔐 Reset hasła</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">Twoje konto CRM Atomic</p>
        
        <div class="content">
          <p style="font-size: 16px; margin-top: 0;">Cześć ${firstName}! 👋</p>
          
          <p style="font-size: 16px;">
            Otrzymaliśmy prośbę o reset hasła do Twojego konta. Jeśli to Ty złożyłeś tę prośbę, kliknij poniższy przycisk, aby ustawić nowe hasło:
          </p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">
              Zresetuj hasło
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 24px;">
            Lub skopiuj i wklej ten link do przeglądarki:
          </p>
          <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 8px;">
            ${resetUrl}
          </p>
          
          <div class="warning">
            <strong>⚠️ Ważne informacje:</strong><br>
            • Link jest ważny przez <strong>1 godzinę</strong><br>
            • Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość<br>
            • Twoje hasło pozostanie bez zmian
          </div>
        </div>
        
        <div class="footer">
          <p>CRM Atomic - System zarządzania klientami</p>
          <p style="font-size: 12px; opacity: 0.7;">
            Ta wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Reset hasła - CRM Atomic

Cześć ${firstName}!

Otrzymaliśmy prośbę o reset hasła do Twojego konta.

Aby ustawić nowe hasło, kliknij w poniższy link:
${resetUrl}

Link jest ważny przez 1 godzinę.

Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.
Twoje hasło pozostanie bez zmian.

---
CRM Atomic
Ta wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.
  `;

  try {
    console.log(`[Email] 📧 Attempting to send password reset email to: ${email}`);
    console.log(`[Email] Reset URL: ${resetUrl}`);
    console.log(`[Email] From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: '🔐 Reset hasła - CRM Atomic',
      text: textContent,
      html: htmlContent,
    });
    
    console.log(`[Email] ✅ Password reset email sent successfully to ${email}`);
    console.log(`[Email] Message ID: ${info.messageId}`);
    console.log(`[Email] Response: ${info.response}`);
    return true;
  } catch (error: any) {
    console.error('[Email] ❌ Failed to send password reset email');
    console.error('[Email] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    console.error('[Email] Full error:', error);
    throw error;
  }
}

export async function sendTestEmail(to: string) {
  const transporter = createTransporter();
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Test Email - CRM Atomic',
      text: 'This is a test email from CRM Atomic.',
      html: '<p>This is a test email from <strong>CRM Atomic</strong>.</p>',
    });
    
    console.log(`[Email] Test email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send test email:', error);
    throw error;
  }
}

