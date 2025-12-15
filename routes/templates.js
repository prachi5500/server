import express from 'express';
import Template from '../models/Template.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = express.Router();

// Public: list published templates
router.get('/', async (_req, res) => {
  try {
    const items = await Template.find({ status: 'published' }).sort({ updated_at: -1 }).lean();
    res.json(items.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Admin: list all
router.get('/all', authRequired, adminRequired, async (_req, res) => {
  try {
    const items = await Template.find().sort({ updated_at: -1 }).lean();
    res.json(items.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Admin: create
router.post('/', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, status = 'draft', config = {}, background_url = null, back_background_url = null, thumbnail_url = null, price = 2.99, } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const created = await Template.create({
      name,
      status,
      config,
      background_url,
      back_background_url,
      thumbnail_url,
      price,
      created_by: req.user._id,
    });
    res.status(201).json({ id: created._id, ...created.toObject() });
  } catch (e) {
    res.status(500).json({ error: 'Create failed' });
  }
});

// Admin: get one
router.get('/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const t = await Template.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: 'Not found' });
    const { _id, ...rest } = t;
    res.json({ id: _id, ...rest });
  } catch (e) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// Admin: update
router.put('/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const update = req.body || {};
    const t = await Template.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!t) return res.status(404).json({ error: 'Not found' });
    const { _id, ...rest } = t;
    res.json({ id: _id, ...rest });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Admin: delete
router.delete('/:id', authRequired, adminRequired, async (req, res) => {
  try {
    await Template.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
