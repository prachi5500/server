import express from 'express';
import nodemailer from 'nodemailer';
import ContactMessage from '../models/ContactMessage.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required' });
    }

    // Save to DB
    const saved = await ContactMessage.create({ name, email, message, status: 'new' });

    const subject = `New Contact Message from ${name}`;
    const textBody = `From: ${name} <${email}>\n\n${message}`;
    const htmlBody = `
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `;

    await transporter.sendMail({
      from: process.env.CONTACT_FROM,
      to: process.env.CONTACT_TO,
      replyTo: email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    return res.status(201).json({ ok: true, id: saved._id });
  } catch (e) {
    console.error('CONTACT email send failed', e);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Admin: list messages
router.get('/', authRequired, adminRequired, async (req, res) => {
  try {
    const items = await ContactMessage.find().sort({ createdAt: -1 }).lean();
    res.json(items.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Admin: mark as read
router.patch('/:id/read', authRequired, adminRequired, async (req, res) => {
  try {
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, { status: 'read' }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    const { _id, ...rest } = updated;
    res.json({ id: _id, ...rest });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

export default router;