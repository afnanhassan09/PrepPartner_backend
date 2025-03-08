const nodemailer = require("nodemailer");
require("dotenv").config();

async function sendEmail(to, subject, body) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: to,
    subject: subject,
    text: body,
  });

  console.log("Message sent: %s", info.messageId);
}

module.exports = sendEmail;
