const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendResetEmail(to, resetLink) {
  try {
    console.log("📨 Attempting to send email to:", to);

    const mailOptions = {
      from: `"Your App Name" <${process.env.EMAIL_USER}>`, // ✅ Use a proper "from" name
      to,
      subject: "Password Reset Request",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}" style="font-size:16px; color:#1a73e8;">Click Here to Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p><strong>${resetLink}</strong></p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.response);
  } catch (err) {
    console.error("❌ Email Sending Error:", err);
    throw new Error("Failed to send email.");
  }
}

module.exports = sendResetEmail;
