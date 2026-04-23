// Vercel injects env vars automatically, no dotenv needed
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
const { Pool } = pg;

// Strip channel_binding param which pg module doesn't support
let dbUrl = process.env.DATABASE_URL || '';
dbUrl = dbUrl.replace(/&?channel_binding=require/g, '').replace(/\?&/, '?');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});
const query = (text: string, params?: any[]) => pool.query(text, params);

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'tiffin-aaw-secret-123',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

// DB Init
async function initDb() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', phone TEXT, addresses JSONB NOT NULL DEFAULT '[]', wallet NUMERIC NOT NULL DEFAULT 0)`);
    await query(`CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price NUMERIC NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL)`);
    await query(`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), user_name TEXT NOT NULL, user_email TEXT NOT NULL, items JSONB NOT NULL, total NUMERIC NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, address TEXT NOT NULL, phone TEXT NOT NULL)`);
    await query(`CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, text TEXT NOT NULL, timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, is_admin BOOLEAN DEFAULT FALSE, target_user_id TEXT NOT NULL)`);
    await query(`CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);

    const menuCheck = await query('SELECT count(*) FROM menu_items');
    if (parseInt(menuCheck.rows[0].count) === 0) {
      const items = [
        { id: '1', name: 'Homestyle Thali', description: '2 Roti, Rice, Dal, Sabzi, Curd and Salad.', price: 150, category: 'lunch', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop' },
        { id: '2', name: 'Deluxe Thali', description: 'Special Paneer, Mix Veg, Dal Makhani, 2 Paratha, Rice, Sweet.', price: 250, category: 'lunch', image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=800&auto=format&fit=crop' },
        { id: '3', name: 'Paratha Breakfast', description: '2 Aloo Paratha with Curd and Pickle.', price: 120, category: 'breakfast', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop' },
        { id: '4', name: 'Dal Khichdi', description: 'Light and nutritious dal khichdi with ghee.', price: 100, category: 'dinner', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?q=80&w=800&auto=format&fit=crop' },
        { id: '5', name: 'Poha Special', description: 'Indori Poha with sev, pomegranate, and lemon.', price: 80, category: 'breakfast', image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?q=80&w=800&auto=format&fit=crop' },
        { id: '6', name: 'Executive Meal', description: 'Choice of Paneer, 2 Sabzi, 3 Roti, Rice, Sweet, Dal, Salad, Raita.', price: 300, category: 'lunch', image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop' },
        { id: '7', name: 'Paneer Butter Masala Combo', description: 'Paneer Butter Masala served with 2 Garlic Naan.', price: 220, category: 'dinner', image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=800&auto=format&fit=crop' },
        { id: '8', name: 'Veg Biryani', description: 'Aromatic basmati rice cooked with fresh vegetables and spices.', price: 180, category: 'dinner', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop' },
      ];
      for (const item of items) {
        await query('INSERT INTO menu_items (id, name, description, price, category, image) VALUES ($1, $2, $3, $4, $5, $6)', [item.id, item.name, item.description, item.price, item.category, item.image]);
      }
    }

    await query(`INSERT INTO admin_settings (key, value) VALUES ('razorpay', '{"keyId": "", "keySecret": ""}') ON CONFLICT (key) DO NOTHING`);

    const adminEmail = 'admin@tiffinaaw.com';
    const userCheck = await query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (userCheck.rows.length === 0) {
      const hashedAdminPw = await bcrypt.hash('admin123', 10);
      await query('INSERT INTO users (id, name, email, password, role, addresses, wallet) VALUES ($1, $2, $3, $4, $5, $6, $7)', ['admin-123', 'Admin', adminEmail, hashedAdminPw, 'admin', '[]', 0]);
    }
    console.log('DB initialized');
  } catch (err) {
    console.error('DB init failed:', err);
  }
}

const dbReady = initDb();

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  await dbReady;
  const { name, email, password, phone } = req.body;
  try {
    const check = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'User already exists' });
    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    const r = await query('INSERT INTO users (id, name, email, password, role, addresses, phone, wallet) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, role, addresses, phone, wallet', [id, name, email, hashed, 'user', '[]', phone || null, 0]);
    (req.session as any).userId = id;
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to register' }); }
});

app.post('/api/auth/login', async (req, res) => {
  await dbReady;
  const { email, password } = req.body;
  try {
    const r = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    (req.session as any).userId = user.id;
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/me', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const r = await query('SELECT id, name, email, role, addresses, phone, wallet FROM users WHERE id = $1', [userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch user' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(() => res.json({ success: true })); });

app.patch('/api/auth/profile', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, phone } = req.body;
  try {
    const r = await query('UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3 RETURNING id, name, email, role, addresses, phone, wallet', [name, phone, userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update profile' }); }
});

app.patch('/api/auth/profile/addresses', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { addresses } = req.body;
  if (!Array.isArray(addresses)) return res.status(400).json({ error: 'Invalid addresses' });
  try {
    const r = await query('UPDATE users SET addresses = $1 WHERE id = $2 RETURNING id, name, email, role, addresses, phone, wallet', [JSON.stringify(addresses), userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update addresses' }); }
});

// Menu Routes
app.get('/api/menu', async (_req, res) => {
  await dbReady;
  try {
    const r = await query('SELECT * FROM menu_items');
    res.json(r.rows);
  } catch (err: any) { res.status(500).json({ error: 'Failed to fetch menu', details: err.message, dbUrl: dbUrl ? 'SET' : 'MISSING' }); }
});

app.post('/api/menu', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { name, description, price, category, image } = req.body;
    const item = { id: uuidv4(), name, description, price, category, image };
    await query('INSERT INTO menu_items (id, name, description, price, category, image) VALUES ($1, $2, $3, $4, $5, $6)', [item.id, item.name, item.description, item.price, item.category, item.image]);
    res.json(item);
  } catch (err) { res.status(500).json({ error: 'Failed to create menu item' }); }
});

app.patch('/api/menu/:id', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { name, description, price, category, image } = req.body;
    const r = await query('UPDATE menu_items SET name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price), category = COALESCE($4, category), image = COALESCE($5, image) WHERE id = $6 RETURNING *', [name, description, price, category, image, req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update menu item' }); }
});

app.delete('/api/menu/:id', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    await query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete menu item' }); }
});

// Order Routes
const mapOrder = (o: any) => ({ ...o, userId: o.user_id, userName: o.user_name, userEmail: o.user_email, createdAt: o.created_at });

app.post('/api/orders', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const ru = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = ru.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { items, total, address, phone, useWallet } = req.body;
    if (useWallet) {
      if (parseFloat(user.wallet) < total) return res.status(400).json({ error: 'Insufficient wallet balance' });
      await query('UPDATE users SET wallet = wallet - $1 WHERE id = $2', [total, userId]);
    }
    const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const order = { id: orderId, userId, userName: user.name, userEmail: user.email, items, total, status: 'pending', createdAt: new Date().toISOString(), address, phone };
    await query('INSERT INTO orders (id, user_id, user_name, user_email, items, total, status, created_at, address, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [order.id, order.userId, order.userName, order.userEmail, JSON.stringify(order.items), order.total, order.status, order.createdAt, order.address, order.phone]);
    res.json(order);
  } catch (err) { res.status(500).json({ error: 'Failed to place order' }); }
});

app.get('/api/orders/my', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(r.rows.map(mapOrder));
  } catch (err) { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

app.get('/api/orders', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role === 'admin') {
      const r = await query('SELECT * FROM orders ORDER BY created_at DESC');
      res.json(r.rows.map(mapOrder));
    } else {
      const r = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      res.json(r.rows.map(mapOrder));
    }
  } catch (err) { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { status } = req.body;
    const r = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(mapOrder(r.rows[0]));
  } catch (err) { res.status(500).json({ error: 'Failed to update order status' }); }
});

app.post('/api/orders/:id/cancel', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const ro = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (ro.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const od = ro.rows[0];
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (od.user_id !== userId && u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    if (od.status !== 'pending' && u.rows[0]?.role !== 'admin') return res.status(400).json({ error: 'Cannot cancel' });
    const r = await query("UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *", [req.params.id]);
    res.json(mapOrder(r.rows[0]));
  } catch (err) { res.status(500).json({ error: 'Failed to cancel order' }); }
});

// Admin
app.get('/api/admin/users', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const r = await query('SELECT id, name, email, role, phone, addresses, wallet FROM users');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

app.patch('/api/admin/users/:id/role', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const cu = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (cu.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const tu = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (tu.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    let newRole = req.body.role;
    if (!newRole || (newRole !== 'admin' && newRole !== 'user')) newRole = tu.rows[0].role === 'admin' ? 'user' : 'admin';
    await query('UPDATE users SET role = $1 WHERE id = $2', [newRole, req.params.id]);
    res.json({ success: true, newRole });
  } catch (err) { res.status(500).json({ error: 'Failed to update user role' }); }
});

app.get('/api/admin/settings', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const r = await query("SELECT value FROM admin_settings WHERE key = 'razorpay'");
    res.json({ razorpay: r.rows[0]?.value || { keyId: '', keySecret: '' } });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

app.post('/api/admin/settings', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const u = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (u.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    if (req.body.razorpay) {
      await query("INSERT INTO admin_settings (key, value) VALUES ('razorpay', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [JSON.stringify(req.body.razorpay)]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save settings' }); }
});

// Chat
app.get('/api/chat', async (req, res) => {
  await dbReady;
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await query('SELECT * FROM chats WHERE target_user_id = $1 ORDER BY timestamp ASC', [userId]);
    res.json(r.rows.map(c => ({ ...c, senderId: c.sender_id, senderName: c.sender_name, isAdmin: c.is_admin })));
  } catch (err) { res.status(500).json({ error: 'Failed to fetch chats' }); }
});

// Upload placeholder for Vercel (no local disk)
app.post('/api/upload', (_req, res) => {
  res.status(501).json({ error: 'File uploads not supported on serverless. Use image URLs instead.' });
});

// Catch-all
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
});

export default app;
