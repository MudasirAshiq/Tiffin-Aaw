import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { User, Order, OrderStatus, MenuItem, ChatMessage } from './src/types';
import { query, pool } from './src/lib/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  const PORT = 3000;

  // Ensure uploads directory exists (use /tmp on Vercel)
  const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn("Could not create uploads directory (likely read-only filesystem)");
  }

  // Set up storage for uploaded files
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const uploadMiddleware = multer({ storage });

  // Database Initialization
  async function initDb() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          phone TEXT,
          addresses JSONB NOT NULL DEFAULT '[]',
          wallet NUMERIC NOT NULL DEFAULT 0
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price NUMERIC NOT NULL,
          category TEXT NOT NULL,
          image TEXT NOT NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          user_name TEXT NOT NULL,
          user_email TEXT NOT NULL,
          items JSONB NOT NULL,
          total NUMERIC NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          address TEXT NOT NULL,
          phone TEXT NOT NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_admin BOOLEAN DEFAULT FALSE,
          target_user_id TEXT NOT NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        )
      `);

      // Seed initial menu if empty
      const menuCheck = await query('SELECT count(*) FROM menu_items');
      if (parseInt(menuCheck.rows[0].count) === 0) {
        const initialMenu = [
          { id: '1', name: 'Homestyle Thali', description: '2 Roti, Rice, Dal, Sabzi, Curd and Salad.', price: 150, category: 'lunch', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop' },
          { id: '2', name: 'Deluxe Thali', description: 'Special Paneer, Mix Veg, Dal Makhani, 2 Paratha, Rice, Sweet.', price: 250, category: 'lunch', image: 'https://images.unsplash.com/photo-1626777552726-4a6b547b4de5?q=80&w=800&auto=format&fit=crop' },
          { id: '3', name: 'Paratha Breakfast', description: '2 Aloo Paratha with Curd and Pickle.', price: 120, category: 'breakfast', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop' },
          { id: '4', name: 'Dal Khichdi', description: 'Light and nutritious dal khichdi with ghee.', price: 100, category: 'dinner', image: 'https://images.unsplash.com/photo-1545231027-63b3f162934c?q=80&w=800&auto=format&fit=crop' },
          { id: '5', name: 'Poha Special', description: 'Indori Poha with sev, pomegranate, and lemon.', price: 80, category: 'breakfast', image: 'https://images.unsplash.com/photo-1626132646533-46b582048fd6?q=80&w=800&auto=format&fit=crop' },
          { id: '6', name: 'Executive Meal', description: 'Choice of Paneer, 2 Sabzi, 3 Roti, Rice, Sweet, Dal, Salad, Raita.', price: 300, category: 'lunch', image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop' },
          { id: '7', name: 'Paneer Butter Masala Combo', description: 'Paneer Butter Masala served with 2 Garlic Naan.', price: 220, category: 'dinner', image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=800&auto=format&fit=crop' },
          { id: '8', name: 'Veg Biryani', description: 'Aromatic basmati rice cooked with fresh vegetables and spices.', price: 180, category: 'dinner', image: 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=800&auto=format&fit=crop' },
        ];
        for (const item of initialMenu) {
          await query('INSERT INTO menu_items (id, name, description, price, category, image) VALUES ($1, $2, $3, $4, $5, $6)', [item.id, item.name, item.description, item.price, item.category, item.image]);
        }
      }

      // Seed initial admin settings
      await query(`
        INSERT INTO admin_settings (key, value)
        VALUES ('razorpay', '{"keyId": "", "keySecret": ""}')
        ON CONFLICT (key) DO NOTHING
      `);

      // Seed admin accounts
      const adminEmail = 'admin@tiffinaaw.com';
      const userCheck = await query('SELECT * FROM users WHERE email = $1', [adminEmail]);
      if (userCheck.rows.length === 0) {
        const hashedAdminPw = await bcrypt.hash('admin123', 10);
        await query('INSERT INTO users (id, name, email, password, role, addresses, wallet) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
          ['admin-123', 'Admin', adminEmail, hashedAdminPw, 'admin', '[]', 0]);
      }

      const testAdminEmail = 'qfons.sda@gmail.com';
      const testAdminCheck = await query('SELECT * FROM users WHERE email = $1', [testAdminEmail]);
      if (testAdminCheck.rows.length === 0) {
        const hashedTestPw = await bcrypt.hash('admin123', 10);
        await query('INSERT INTO users (id, name, email, password, role, addresses, wallet, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
          [uuidv4(), 'Test Admin', testAdminEmail, hashedTestPw, 'admin', JSON.stringify(['123 Sector, Admin City']), 100, '+91 8888888888']);
      }

      console.log('Database initialized successfully');
    } catch (err) {
      console.error('Database initialization failed:', err);
    }
  }

  await initDb();

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Middlewares
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: 'tiffin-aaw-secret-123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
  }));

  app.use('/uploads', express.static(uploadsDir));

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    try {
      const check = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (check.rows.length > 0) return res.status(400).json({ error: 'User already exists' });
      
      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);
      const resUser = await query(
        'INSERT INTO users (id, name, email, password, role, addresses, phone, wallet) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, role, addresses, phone, wallet',
        [id, name, email, hashedPassword, 'user', '[]', phone || null, 0]
      );
      
      (req.session as any).userId = id;
      res.json(resUser.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to register' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const resUser = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (resUser.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
      
      const user = resUser.rows[0];
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });
      
      (req.session as any).userId = user.id;
      const { password: _, ...userWithoutPw } = user;
      res.json(userWithoutPw);
    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const resUser = await query('SELECT id, name, email, role, addresses, phone, wallet FROM users WHERE id = $1', [userId]);
      if (resUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(resUser.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.patch('/api/auth/profile', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, phone } = req.body;
    try {
      const resUpdate = await query(
        'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3 RETURNING id, name, email, role, addresses, phone, wallet',
        [name, phone, userId]
      );
      if (resUpdate.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(resUpdate.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.patch('/api/auth/profile/addresses', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { addresses } = req.body;
    if (!Array.isArray(addresses)) return res.status(400).json({ error: 'Invalid addresses' });

    try {
      const resUpdate = await query(
        'UPDATE users SET addresses = $1 WHERE id = $2 RETURNING id, name, email, role, addresses, phone, wallet',
        [JSON.stringify(addresses), userId]
      );
      if (resUpdate.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(resUpdate.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update addresses' });
    }
  });

  // Menu Routes
  app.post('/api/upload', uploadMiddleware.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  app.get('/api/menu', async (req, res) => {
    try {
      const resMenu = await query('SELECT * FROM menu_items');
      res.json(resMenu.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  });

  app.post('/api/menu', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

      const { name, description, price, category, image } = req.body;
      const newItem = { id: uuidv4(), name, description, price, category, image };
      await query(
        'INSERT INTO menu_items (id, name, description, price, category, image) VALUES ($1, $2, $3, $4, $5, $6)',
        [newItem.id, newItem.name, newItem.description, newItem.price, newItem.category, newItem.image]
      );
      res.json(newItem);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create menu item' });
    }
  });

  app.patch('/api/menu/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

      const { name, description, price, category, image } = req.body;
      const resUpdate = await query(
        'UPDATE menu_items SET name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price), category = COALESCE($4, category), image = COALESCE($5, image) WHERE id = $6 RETURNING *',
        [name, description, price, category, image, req.params.id]
      );
      if (resUpdate.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
      res.json(resUpdate.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update menu item' });
    }
  });

  app.delete('/api/menu/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

      await query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete menu item' });
    }
  });

  // Order Routes
  app.post('/api/orders', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
      const resUser = await query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = resUser.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { items, total, address, phone, useWallet } = req.body;
      
      if (useWallet) {
        const wallet = parseFloat(user.wallet);
        if (wallet < total) {
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
        await query('UPDATE users SET wallet = wallet - $1 WHERE id = $2', [total, userId]);
      }

      const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const order = {
        id: orderId,
        userId,
        userName: user.name,
        userEmail: user.email,
        items,
        total,
        status: 'pending' as OrderStatus,
        createdAt: new Date().toISOString(),
        address,
        phone
      };

      await query(
        'INSERT INTO orders (id, user_id, user_name, user_email, items, total, status, created_at, address, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [order.id, order.userId, order.userName, order.userEmail, JSON.stringify(order.items), order.total, order.status, order.createdAt, order.address, order.phone]
      );
      
      // Notify admins
      io.emit('admin:new_order', order);
      
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'Failed to place order' });
    }
  });

  app.get('/api/orders/my', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resOrders = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      // Standardize camelCase for frontend
      const orders = resOrders.rows.map(o => ({
        ...o,
        userId: o.user_id,
        userName: o.user_name,
        userEmail: o.user_email,
        createdAt: o.created_at
      }));
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const user = resUser.rows[0];

      if (user?.role === 'admin') {
        const resOrders = await query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(resOrders.rows.map(o => ({
          ...o,
          userId: o.user_id,
          userName: o.user_name,
          userEmail: o.user_email,
          createdAt: o.created_at
        })));
      } else {
        const resOrders = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(resOrders.rows.map(o => ({
          ...o,
          userId: o.user_id,
          userName: o.user_name,
          userEmail: o.user_email,
          createdAt: o.created_at
        })));
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

      const { status } = req.body;
      const resUpdate = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
      if (resUpdate.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

      const order = {
        ...resUpdate.rows[0],
        userId: resUpdate.rows[0].user_id,
        userName: resUpdate.rows[0].user_name,
        userEmail: resUpdate.rows[0].user_email,
        createdAt: resUpdate.rows[0].created_at
      };
      
      // Notify user in real-time
      io.emit(`order:${order.id}:status`, order);
      io.emit('orders:updated', order);

      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  app.post('/api/orders/:id/cancel', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const resOrder = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (resOrder.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
      const orderData = resOrder.rows[0];
      
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const user = resUser.rows[0];

      if (orderData.user_id !== userId && user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (orderData.status !== 'pending' && user?.role !== 'admin') {
        return res.status(400).json({ error: 'Order is already being prepared and cannot be cancelled.' });
      }

      const resUpdate = await query("UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *", [req.params.id]);
      const order = {
        ...resUpdate.rows[0],
        userId: resUpdate.rows[0].user_id,
        userName: resUpdate.rows[0].user_name,
        userEmail: resUpdate.rows[0].user_email,
        createdAt: resUpdate.rows[0].created_at
      };

      io.emit('orders:updated', order);
      io.emit(`order:${order.id}:status`, order);
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // Admin User Management
  app.get('/api/admin/users', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
      
      const resUsers = await query('SELECT id, name, email, role, phone, addresses, wallet FROM users');
      res.json(resUsers.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.patch('/api/admin/users/:id/role', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resCurrentUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resCurrentUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

      const resTargetUser = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
      if (resTargetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      let newRole = req.body.role;
      if (!newRole || (newRole !== 'admin' && newRole !== 'user')) {
        newRole = resTargetUser.rows[0].role === 'admin' ? 'user' : 'admin';
      }

      await query('UPDATE users SET role = $1 WHERE id = $2', [newRole, req.params.id]);
      res.json({ success: true, newRole });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user role' });
    }
  });

  // Admin Settings
  app.get('/api/admin/settings', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
      
      const resSettings = await query("SELECT value FROM admin_settings WHERE key = 'razorpay'");
      res.json({ razorpay: resSettings.rows[0]?.value || { keyId: '', keySecret: '' } });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.post('/api/admin/settings', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resUser = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (resUser.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
      
      if (req.body.razorpay) {
        await query(
          "INSERT INTO admin_settings (key, value) VALUES ('razorpay', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
          [JSON.stringify(req.body.razorpay)]
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // Chat/Support Routes
  app.get('/api/chat', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const resChats = await query('SELECT * FROM chats WHERE target_user_id = $1 ORDER BY timestamp ASC', [userId]);
      res.json(resChats.rows.map(c => ({
        ...c,
        senderId: c.sender_id,
        senderName: c.sender_name,
        isAdmin: c.is_admin
      })));
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  // Socket management
  io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('chat:message', async ({ userId, text, senderName, isAdmin }) => {
      const msg: ChatMessage = {
        id: uuidv4(),
        senderId: userId,
        senderName,
        text,
        timestamp: new Date().toISOString(),
        isAdmin
      };
      
      try {
        await query(
          'INSERT INTO chats (id, sender_id, sender_name, text, timestamp, is_admin, target_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [msg.id, msg.senderId, msg.senderName, msg.text, msg.timestamp, msg.isAdmin, userId]
        );

        // Simple keyword logic for chatbot if not admin
        if (!isAdmin) {
          // Echo to user
          socket.emit(`chat:${userId}`, msg);
          // Broadcast to admin room
          io.emit('admin:chat_message', msg);

          // Logic-based bot response
          const lowerText = text.toLowerCase();
          let botResponse = "";

          // Fetch menu for bot logic
          const resMenu = await query('SELECT * FROM menu_items');
          const menu = resMenu.rows;

          // 1. Specific Menu Item Inquiry
          const mentionedItem = menu.find(item => lowerText.includes(item.name.toLowerCase()));
          
          // 2. Category Inquiry
          const categories = ['breakfast', 'lunch', 'dinner', 'snack'];
          const mentionedCategory = categories.find(c => lowerText.includes(c));

          // 3. Delivery Time / Status Inquiry
          const isTimeQuery = lowerText.includes('when') || lowerText.includes('time') || lowerText.includes('status') || lowerText.includes('delivery') || lowerText.includes('track');
          const resActiveOrders = await query("SELECT * FROM orders WHERE user_id = $1 AND status NOT IN ('delivered', 'cancelled')", [userId]);
          const activeOrders = resActiveOrders.rows;

          if (mentionedItem) {
            botResponse = `Excellent choice! The ${mentionedItem.name} is priced at ₹${mentionedItem.price}. It's a ${mentionedItem.description}. You can find it under our ${mentionedItem.category} section.`;
          } else if (mentionedCategory) {
            const categoryItems = menu.filter(i => i.category === mentionedCategory).slice(0, 3).map(i => i.name).join(', ');
            botResponse = `Our ${mentionedCategory} specials include ${categoryItems}, and more! Would you like to see the full ${mentionedCategory} menu?`;
          } else if (isTimeQuery && activeOrders.length > 0) {
            const latest = activeOrders[activeOrders.length - 1];
            const estimates: Record<string, string> = {
              'pending': 'around 45 mins (awaiting kitchen confirmation)',
              'preparing': 'roughly 25-30 mins (chef is cooking)',
              'on-the-way': 'about 10-15 mins (rider is in transit)'
            };
            botResponse = `I found your active order #${latest.id}. Current status: ${latest.status.toUpperCase()}. Estimated arrival: ${estimates[latest.status] || 'very soon'}!`;
          } else if (lowerText.includes('spicy') || lowerText.includes('custom') || lowerText.includes('pepper')) {
            botResponse = "Most of our dishes can be customized! You can leave a 'Note for Chef' during checkout to specify your spice preference or dietary requirements.";
          } else if (lowerText.includes('coupon') || lowerText.includes('offer') || lowerText.includes('discount')) {
            botResponse = "We currently have a 'WELCOME50' offer for first-time users. Also, check out our wallet for loyalty credits earned on every order!";
          } else if (lowerText.includes('menu') || lowerText.includes('recommend') || lowerText.includes('eat') || lowerText.includes('food')) {
            const topItems = menu.slice(0, 3).map(i => i.name).join(', ');
            botResponse = `You should definitely try our ${topItems}! We have a wide variety of North Indian and street food specials. Check the Home tab for the full list.`;
          } else if (lowerText.includes('cold') || lowerText.includes('quality') || lowerText.includes('bad')) {
            botResponse = "We're truly sorry to hear about your experience. Our quality control team is investigating this immediately. As a compensation, we've initiated a ₹50 credit to your Tiffin wallet.";
            await query('UPDATE users SET wallet = wallet + 50 WHERE id = $1', [userId]);
          } else if (lowerText.includes('refund') || lowerText.includes('money')) {
            botResponse = "Refunds are processed within 24-48 business hours to your original payment method. Please provide the Order ID if you'd like me to escalate this.";
          } else if (lowerText.includes('address') || lowerText.includes('location')) {
            botResponse = "You can manage your saved locations in the Profile section. Remember, addresses cannot be changed once an order is 'on-the-way'.";
          } else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
            botResponse = "Namaste! I'm Tiffin Bot. I can help you with menu details, order tracking, or quality issues. What's on your mind?";
          } else {
            botResponse = "I'm still learning, but I've notified a human agent to assist you shortly. In the meantime, feel free to ask about our menu or your order status!";
          }
          
          if (botResponse) {
            const botMsg: ChatMessage = {
              id: uuidv4(),
              senderId: 'bot',
              senderName: 'Tiffin Bot',
              text: botResponse,
              timestamp: new Date().toISOString(),
              isAdmin: true
            };
            await query(
              'INSERT INTO chats (id, sender_id, sender_name, text, timestamp, is_admin, target_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [botMsg.id, botMsg.senderId, botMsg.senderName, botMsg.text, botMsg.timestamp, true, userId]
            );
            setTimeout(() => {
              socket.emit(`chat:${userId}`, botMsg);
            }, 1000);
          }
        } else {
          // Admin replying to user
          socket.emit(`chat:${userId}`, msg);
          io.emit(`chat:${userId}`, msg);
        }
      } catch (err) {
        console.error('Socket chat error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  // Fallback for API routes that don't exist
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback to index.html for SPA
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Pre-seed logic removed as it's now handled by initDb()

  if (!process.env.VERCEL) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  return app;
}

let appInstance: any = null;
let startError: any = null;

async function init() {
  try {
    appInstance = await startServer();
  } catch (err) {
    startError = err;
    console.error("FAILED TO START SERVER:", err);
  }
}

const initPromise = init();

export default async (req: any, res: any) => {
  await initPromise;
  if (startError) {
    return res.status(500).json({
      error: "Server Startup Failed",
      message: startError.message || startError.toString(),
      stack: startError.stack
    });
  }
  if (appInstance) {
    return appInstance(req, res);
  }
  return res.status(500).json({ error: "App instance is missing" });
};
