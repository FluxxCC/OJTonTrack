import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  // For now, we use a dummy transport or read from env
  // If env vars are not set, we'll just log to console (ethereal) or fail gracefully
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Boolean(process.env.SMTP_SECURE) || false,
  auth: {
    user: process.env.SMTP_USER || "dummy@example.com",
    pass: process.env.SMTP_PASS || "dummy",
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
    console.log("---------------------------------------------------");
    console.log(`[Mock Email] To: ${to}`);
    console.log(`[Mock Email] Subject: ${subject}`);
    console.log(`[Mock Email] HTML: ${html}`);
    console.log("---------------------------------------------------");
    return;
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"OJTonTrack" <no-reply@ojtontrack.com>',
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("Failed to send email:", e);
    // Fallback to log
    console.log("---------------------------------------------------");
    console.log(`[Mock Email (Fallback)] To: ${to}`);
    console.log(`[Mock Email (Fallback)] Subject: ${subject}`);
    console.log(`[Mock Email (Fallback)] HTML: ${html}`);
    console.log("---------------------------------------------------");
  }
}
