import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Utensils, 
  Clock, 
  MessageSquare, 
  User as UserIcon, 
  LogOut, 
  ChevronRight, 
  Plus, 
  Minus,
  CheckCircle2,
  Package,
  Truck,
  Building,
  ShieldCheck,
  ShieldAlert,
  Send,
  X,
  CreditCard,
  Search,
  Bell,
  BellRing,
  Upload,
  Image as ImageIcon,
  MapPin,
  History,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Users,
  Filter,
  Check,
  Navigation2,
  Mail,
  Phone,
  UtensilsCrossed,
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Settings
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { 
  ResponsiveContainer, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Area 
} from 'recharts';
import { cn, formatCurrency } from './lib/utils';
import type { User, UserRole, MenuItem, CartItem, Order, OrderStatus, ChatMessage, AdminSettings } from './types';

// Components
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  type = 'danger' 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText: string,
  type?: 'danger' | 'info'
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-[40px] p-10 shadow-2xl text-center"
      >
        <div className={cn(
          "w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-8",
          type === 'danger' ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"
        )}>
           {type === 'danger' ? <ShieldAlert size={40} /> : <CheckCircle2 size={40} />}
        </div>
        <h3 className="text-2xl font-black tracking-tight mb-4">{title}</h3>
        <p className="text-gray-400 font-bold text-sm leading-relaxed mb-10">{message}</p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className={cn(
              "w-full p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95",
              type === 'danger' ? "bg-red-500 text-white shadow-red-100" : "bg-orange-500 text-white shadow-orange-100"
            )}
          >
            {confirmText}
          </button>
          <button 
            onClick={onClose}
            className="w-full p-5 rounded-2xl bg-gray-50 text-gray-400 font-black text-sm uppercase tracking-widest hover:bg-gray-100 transition-all"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ activeTab, setActiveTab, cartCount, role }: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void, 
  cartCount: number,
  role?: string 
}) => {
  const tabs = role === 'admin' 
    ? [
        { id: 'admin-dashboard', icon: LayoutDashboard, label: 'Stats' },
        { id: 'admin-orders', icon: Package, label: 'Orders' },
        { id: 'admin-menu', icon: Utensils, label: 'Menu' },
        { id: 'admin-users', icon: Users, label: 'Users' },
        { id: 'admin-support', icon: MessageSquare, label: 'Chat' },
        { id: 'admin-settings', icon: Settings, label: 'Setup' }
      ]
    : [
        { id: 'home', icon: Utensils, label: 'Menu' },
        { id: 'orders', icon: Clock, label: 'Track' },
        { id: 'support', icon: MessageSquare, label: 'Help' },
        { id: 'profile', icon: UserIcon, label: 'Me' }
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-gray-100 px-4 sm:px-6 pb-6 sm:pb-8 pt-4 z-50">
      <div className="flex justify-between items-center max-w-lg mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300 relative group flex-1 min-w-0",
              activeTab === tab.id ? "text-orange-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all duration-300",
              activeTab === tab.id ? "bg-orange-50" : "group-hover:bg-gray-50"
            )}>
              <tab.icon size={role === 'admin' ? 18 : 20} className={activeTab === tab.id ? "stroke-[2.5px]" : "stroke-2"} />
            </div>
            <span className={cn(
              "text-[8px] sm:text-[9px] uppercase font-black tracking-tighter truncate w-full text-center px-1",
              role === 'admin' ? "" : "sm:block"
            )}>{tab.label}</span>
            {tab.id === 'home' && cartCount > 0 && (
              <span className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-orange-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white font-black scale-90 sm:scale-100">
                {cartCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Utility for robust fetching
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 5, backoff = 1000): Promise<Response> => {
  try {
    const res = await fetch(url, options);
    if (!res.ok && res.status >= 500 && retries > 0) {
      throw new Error(`Server error: ${res.status}`);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      console.log(`Retrying fetch to ${url}... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
    }
    throw err;
  }
};

export default function App() {
  const [view, setView] = useState<'auth' | 'app'>('app');
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<{ id: string, title: string, message: string, type: 'info' | 'success' | 'warning' }[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    checkAuth();
    fetchMenu();
  }, []);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, title, message, type }, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    // Browser Notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/favicon.ico' });
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMenu();
      fetchOrders();
      fetchChat();
      
      const socket = io();
      socketRef.current = socket;

      if (user.role === 'admin') {
        socket.on('admin:new_order', (order) => {
          setOrders(prev => [order, ...prev]);
          addToast('New Order! 🚀', `Order #${order.id} received for ${formatCurrency(order.total)}`, 'success');
          if (Notification.permission === 'granted') {
            new Notification('New Tiffin Order!', {
              body: `Order #${order.id} from ${order.userName}`,
              icon: '/logo.png'
            });
          }
        });
        socket.on('admin:chat_message', (msg) => {
          setChatMessages(prev => [...prev, msg]);
          if (!msg.isAdmin) {
            addToast('Support Query', `${msg.senderName}: ${msg.text.substring(0, 30)}...`, 'info');
            if (Notification.permission === 'granted') {
              new Notification(`Message from ${msg.senderName}`, {
                body: msg.text,
                icon: '/logo.png'
              });
            }
          }
        });
      }

      socket.on(`chat:${user.id}`, (msg) => {
        setChatMessages(prev => [...prev, msg]);
        if (msg.isAdmin) {
          addToast('Support Message', `Agent: ${msg.text.substring(0, 30)}...`, 'info');
          if (Notification.permission === 'granted') {
            new Notification('Support Agent', {
              body: msg.text,
              icon: '/logo.png'
            });
          }
        }
      });

      socket.on('orders:updated', (order) => {
        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
        if (activeOrder?.id === order.id) setActiveOrder(order);
        
        // Notify user of status update
        if (user.role === 'user' && order.userId === user.id) {
          const statusMap: Record<string, string> = {
            'preparing': 'Kitchen is cooking 👨‍🍳',
            'on-the-way': 'Food is out for delivery! 🛵',
            'delivered': 'Enjoy your meal! Delivered ✅',
            'cancelled': 'Order has been cancelled ❌'
          };
          if (statusMap[order.status]) {
            addToast('Order Update', statusMap[order.status], 'warning');
            if (Notification.permission === 'granted') {
              new Notification('Order status updated', {
                body: statusMap[order.status],
                icon: '/logo.png'
              });
            }
          }
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, activeOrder]);

  const checkAuth = async () => {
    try {
      setConnectionError(false);
      const res = await fetchWithRetry('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (data.role === 'admin') setActiveTab('admin-orders');
        addToast(`Welcome back, ${data.name}!`, "Your tiffin journey continues.", "success");
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      // No longer setting view to auth here, as we want to allow guest browsing
    } finally {
      setIsAuthLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetchWithRetry('/api/menu');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMenu(data);
      }
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetchWithRetry('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  };

  const fetchChat = async () => {
    try {
      const res = await fetchWithRetry('/api/chat');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setChatMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch chat:', e);
    }
  };

  const addToCart = (item: MenuItem) => {
    if (!user) {
      setView('auth');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const handleLogout = async () => {
    await fetchWithRetry('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setView('auth');
    setCart([]);
  };

  if (connectionError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center">
          <ShieldCheck size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">Backend is starting...</h2>
          <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">We're getting things ready for you</p>
        </div>
        <button 
          onClick={checkAuth}
          className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-100"
        >
          Try Connecting Again
        </button>
      </div>
    );
  }

  if (isAuthLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full" />
      
      <motion.div
        animate={{ 
          rotate: [0, 15, -15, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl shadow-orange-500/20 flex items-center justify-center text-orange-500 mb-8 border border-orange-100 relative z-10"
      >
        {/* Outer spinning ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-2 rounded-[2.5rem] border-2 border-orange-500 border-t-transparent border-l-transparent opacity-30" 
        />
        {/* Inner spoon and fork */}
        <UtensilsCrossed size={44} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
      </motion.div>

      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 text-center"
      >
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 leading-none">Tiffin<span className="text-orange-500">Aaw</span></h1>
        <p className="text-[11px] font-bold text-orange-400/80 tracking-[0.3em] uppercase mt-2">Preparing...</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-100">
      <AnimatePresence mode="wait">
        {view === 'auth' ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <AuthView setUser={setUser} setView={setView} />
          </motion.div>
        ) : (
          <motion.div 
            key="app" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="pb-32"
          >
            <header className="px-4 sm:px-6 pt-8 sm:pt-12 pb-4 sm:pb-6 bg-white/50 backdrop-blur-lg sticky top-0 z-40 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-gray-900 leading-none">Tiffin<span className="text-orange-500">Aaw</span></h1>
                  <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1">Ghar jaisa swad</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {!user && activeTab === 'home' && (
                    <button 
                      onClick={() => setView('auth')}
                      className="bg-gray-900 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200 active:scale-95 transition-all text-nowrap"
                    >
                      Login
                    </button>
                  )}
                  {user && cart.length > 0 && activeTab === 'home' && (
                    <button onClick={() => setActiveTab('cart')} className="bg-orange-500 text-white p-2.5 sm:p-3 rounded-2xl shadow-lg shadow-orange-200 relative active:scale-90 transition-all">
                      <ShoppingBag size={18} />
                      <span className="absolute -top-1 -right-1 bg-white text-orange-500 text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold border border-orange-100">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                    </button>
                  )}
                </div>
              </div>

              {activeTab === 'home' && (
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                  <input 
                    type="text"
                    placeholder="Craving for something specific?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/70 backdrop-blur-sm border border-gray-100 p-4 pl-14 rounded-2xl text-[13px] font-bold text-gray-900 placeholder:text-gray-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-200 transition-all outline-none shadow-sm"
                  />
                </div>
              )}
            </header>

            <main className="max-w-xl mx-auto px-6">
              <AnimatePresence mode="wait">
                {activeTab === 'home' && (
                  <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MenuView menu={menu} addToCart={addToCart} cart={cart} removeFromCart={removeFromCart} searchQuery={searchQuery} />
                  </motion.div>
                )}
                {activeTab === 'cart' && user && (
                  <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CartView cart={cart} setCart={setCart} setActiveTab={setActiveTab} user={user} addToast={addToast} />
                  </motion.div>
                )}
                {activeTab === 'orders' && user && (
                  <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <OrdersView orders={orders} setActiveOrder={setActiveOrder} />
                  </motion.div>
                )}
                {activeTab === 'support' && user && (
                  <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SupportView user={user!} messages={chatMessages} socket={socketRef.current!} />
                  </motion.div>
                )}
                {activeTab === 'profile' && user && (
                  <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ProfileView 
                      user={user!} 
                      orders={orders.filter(o => o.userId === user?.id)}
                      setUser={setUser}
                      onLogout={handleLogout} 
                      notificationsEnabled={notificationsEnabled}
                      requestPermission={requestNotificationPermission}
                      setActiveTab={setActiveTab}
                    />
                  </motion.div>
                )}
                {(!user && activeTab !== 'home') && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6"
                  >
                    <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center">
                      <ShieldCheck size={40} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Login Required</h2>
                      <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">Please login to access this feature</p>
                    </div>
                    <button 
                      onClick={() => setView('auth')}
                      className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-100"
                    >
                      Login Now
                    </button>
                  </motion.div>
                )}
                
                {/* Admin Tabs */}
                {user?.role === 'admin' && (
                  <AnimatePresence mode="wait">
                    {activeTab === 'admin-dashboard' && (
                      <motion.div key="admin-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminDashboardView orders={orders} />
                      </motion.div>
                    )}
                    {activeTab === 'admin-orders' && (
                      <motion.div key="admin-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminOrdersView orders={orders} fetchOrders={fetchOrders} />
                      </motion.div>
                    )}
                    {activeTab === 'admin-menu' && (
                      <motion.div key="admin-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminMenuView menu={menu} fetchMenu={fetchMenu} />
                      </motion.div>
                    )}
                    {activeTab === 'admin-users' && (
                      <motion.div key="admin-users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminUsersView />
                      </motion.div>
                    )}
                    {activeTab === 'admin-support' && (
                      <motion.div key="admin-support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminSupportView user={user!} messages={chatMessages} socket={socketRef.current!} />
                      </motion.div>
                    )}
                    {activeTab === 'admin-settings' && (
                      <motion.div key="admin-settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminSettingsView addToast={addToast} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </AnimatePresence>
            </main>

            <Navbar activeTab={activeTab} setActiveTab={setActiveTab} cartCount={cart.length} role={user?.role} />
            
            <ToastContainer toasts={toasts} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {activeOrder && (
        <OrderTrackerModal order={activeOrder} onClose={() => setActiveOrder(null)} />
      )}
    </div>
  );
}

// Views
const AuthView = ({ setUser, setView }: { setUser: (u: User) => void, setView: (v: 'app') => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data);
      setView('app');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gray-50 relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl shadow-gray-200 border border-gray-50 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="bg-orange-500 w-16 h-16 rounded-[24px] mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-orange-100 transform rotate-12">
             <Utensils size={32} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 leading-none">Tiffin<span className="text-orange-500 italic">Aaw</span></h2>
          <p className="text-gray-400 font-bold mt-3 text-[10px] uppercase tracking-[0.2em]">{isLogin ? 'Back to your favorite kitchen' : 'Join the elite food club'}</p>
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 text-red-500 p-4 rounded-2xl text-[11px] font-black uppercase text-center mb-6 border border-red-100"
          >
            {error}
          </motion.p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="w-full p-5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 outline-none font-bold text-sm transition-all"
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <input
            type="email"
            placeholder="Email Address"
            required
            className="w-full p-5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 outline-none font-bold text-sm transition-all"
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 outline-none font-bold text-sm transition-all"
            onChange={e => setFormData({ ...formData, password: e.target.value })}
          />
          <button className="w-full bg-orange-500 text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-100 active:scale-95 transition-all mt-4">
            {isLogin ? 'Initiate Session' : 'Create Profile'}
          </button>
        </form>

        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-8 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors"
        >
          {isLogin ? "New here? Register" : 'Have an account? Login'}
        </button>
      </motion.div>
    </div>
  );
};

const MenuView = ({ menu, addToCart, cart, removeFromCart, searchQuery }: { 
  menu: MenuItem[], 
  addToCart: (i: MenuItem) => void,
  cart: CartItem[],
  removeFromCart: (id: string) => void,
  searchQuery: string
}) => {
  const [filter, setFilter] = useState('All');
  
  const searchedMenu = menu.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMenu = filter === 'All' 
    ? searchedMenu 
    : searchedMenu.filter(m => m.category.toLowerCase() === filter.toLowerCase());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-12">
      {/* Hero Section */}
      <section className="relative -mx-6 h-[45vh] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 pb-12">
           <motion.div 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.2 }}
           >
             <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg mb-3 inline-block shadow-lg shadow-orange-500/20">FLASH DEAL</span>
             <h2 className="text-4xl md:text-5xl font-black text-white leading-[0.95] tracking-tighter mb-4 italic">
               Up to 40% OFF<br />
               on Executive<br />
               Meals
             </h2>
             <p className="text-white/80 text-sm font-bold tracking-tight">Order healthy, stay wealthy.</p>
           </motion.div>
        </div>
      </section>

      {/* Featured Packs */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="text-[28px] font-black tracking-tighter leading-none text-gray-900 italic">Recommended</h3>
            <h3 className="text-[28px] font-black tracking-tighter leading-none text-orange-500 italic">For You</h3>
          </div>
          <button className="text-orange-500 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform">SEE ALL</button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
          {menu.slice(0, 3).map(item => (
            <motion.div 
              key={`featured-${item.id}`}
              className="min-w-[280px] bg-white rounded-[40px] overflow-hidden shadow-xl shadow-gray-100 border border-gray-50 flex flex-col"
              whileTap={{ scale: 0.98 }}
            >
              <div className="h-44 relative overflow-hidden">
                <img src={item.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full font-black text-[11px] text-orange-500 shadow-xl border border-orange-50 z-10">
                  {formatCurrency(item.price)}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between min-w-0">
                <div className="min-w-0">
                  <h4 className="font-black text-lg mb-1 leading-tight text-gray-900 border-b border-gray-50 pb-2 line-clamp-1">{item.name}</h4>
                  <p className="text-gray-400 text-[10px] font-bold leading-relaxed line-clamp-2 mt-2">{item.description}</p>
                </div>
                <button 
                  onClick={() => addToCart(item)}
                  className="mt-4 w-full bg-gray-900 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:bg-orange-600 transition-colors"
                >
                  Quick Add +
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Filter Chips */}
      <section className="sticky top-[84px] z-30 -mx-6 px-6 bg-gray-50/90 backdrop-blur-xl py-4 border-b border-gray-200">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {['All', 'Breakfast', 'Lunch', 'Dinner'].map(cat => (
            <button 
              key={cat} 
              onClick={() => setFilter(cat)}
              className={cn(
                "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2",
                filter === cat 
                  ? "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100" 
                  : "bg-white border-white text-gray-400 hover:border-gray-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Full Menu Grid */}
      <section className="grid gap-8">
        {filteredMenu.map(item => {
          const cartItem = cart.find(i => i.id === item.id);
          return (
            <motion.div 
              key={item.id} 
              layout
              className="bg-white rounded-[42px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-700 border border-gray-100 flex p-3 pr-6 gap-6"
            >
              <div className="w-32 h-32 rounded-[32px] overflow-hidden bg-gray-100 flex-shrink-0">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center py-2">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className="font-black text-base tracking-tighter leading-tight text-gray-900 line-clamp-1 flex-1 min-w-0">{item.name}</h3>
                  <span className="text-orange-600 font-black text-base italic whitespace-nowrap shrink-0">{formatCurrency(item.price)}</span>
                </div>
                <p className="text-gray-400 text-[9px] font-black uppercase tracking-wider mb-3">{item.category}</p>
                
                <div className="flex justify-end items-center">
                  {cartItem ? (
                    <div className="flex items-center gap-4 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-orange-600 shadow-sm active:scale-90"><Minus size={14} strokeWidth={4} /></button>
                      <span className="font-black text-orange-600 tabular-nums">{cartItem.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-100 active:scale-90"><Plus size={14} strokeWidth={4} /></button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-gray-50 text-gray-900 border border-gray-100 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all duration-300"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Trust Badges */}
      <section className="pt-8 grid grid-cols-2 gap-4">
         <div className="p-6 bg-orange-50 rounded-[32px] border border-orange-100/50 flex flex-col items-center text-center">
            <ShieldCheck className="text-orange-600 mb-3" size={32} />
            <h5 className="font-black text-xs uppercase tracking-widest mb-1">Hygienic</h5>
            <p className="text-[10px] font-bold text-gray-400">ISO Certified Kitchens</p>
         </div>
         <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100/50 flex flex-col items-center text-center">
            <Truck className="text-blue-600 mb-3" size={32} />
            <h5 className="font-black text-xs uppercase tracking-widest mb-1">Fastest</h5>
            <p className="text-[10px] font-bold text-gray-400">30 Min Delivery</p>
         </div>
      </section>
    </motion.div>
  );
};

const CartView = ({ cart, setCart, setActiveTab, user, addToast }: { 
  cart: CartItem[], 
  setCart: (c: CartItem[]) => void, 
  setActiveTab: (t: string) => void,
  user: User,
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void
}) => {
  const [step, setStep] = useState<'review' | 'address' | 'payment'>('review');
  const [address, setAddress] = useState(user.addresses?.[0] || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [isOrdering, setIsOrdering] = useState(false);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'wallet'>('online');

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 40;
  const total = subtotal + deliveryFee;

  const placeOrder = async () => {
    if (paymentMethod === 'wallet' && (user.wallet || 0) < total) {
      addToast("Payment Error", "Insufficient wallet balance!", "warning");
      return;
    }
    setIsOrdering(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: cart, 
          total, 
          address, 
          phone,
          useWallet: paymentMethod === 'wallet'
        })
      });
      if (res.ok) {
        setCart([]);
        addToast("Order Placed! 🍱", "Your tiffin is being prepared.", "success");
        setActiveTab('orders');
      } else {
        const err = await res.json();
        addToast("Order Failed", err.error || "Something went wrong", "warning");
      }
    } catch (e) {
      console.error(e);
      addToast("Network Error", "Failed to reach server", "warning");
    } finally {
      setIsOrdering(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 bg-gray-100 rounded-[40px] flex items-center justify-center text-gray-300">
          <ShoppingBag size={48} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Your bag is empty</h2>
          <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Hungry? Let's fix that!</p>
        </div>
        <button 
          onClick={() => setActiveTab('home')}
          className="bg-orange-500 text-white px-10 py-4 rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-orange-100 active:scale-95 transition-all"
        >
          Go to Menu
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      {step === 'review' && (
        <div className="space-y-6 md:space-y-8 pb-12">
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
             Review Order <span className="text-gray-300 font-medium font-serif italic text-base md:text-lg uppercase tracking-widest">/ Step 1</span>
          </h2>
          <div className="space-y-3 md:space-y-4 text-nowrap">
            {cart.map(item => (
              <div key={item.id} className="bg-white p-3 md:p-5 rounded-3xl border border-gray-50 flex items-center gap-3 md:gap-4 shadow-sm overflow-hidden">
                <img src={item.image} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black tracking-tight truncate">{item.name}</h4>
                  <p className="text-orange-500 font-bold text-xs italic">{formatCurrency(item.price)} x {item.quantity}</p>
                </div>
                <div className="text-right font-black italic whitespace-nowrap">
                   {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100 space-y-4 overflow-hidden">
            <div className="flex justify-between text-gray-400 font-bold uppercase text-[9px] md:text-[10px] tracking-widest">
              <span>Subtotal</span>
              <span className="text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-400 font-bold uppercase text-[9px] md:text-[10px] tracking-widest">
              <span>Delivery Fee</span>
              <span className="text-gray-900">{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-center bg-orange-50 -mx-8 px-8 py-4 md:py-5 mt-4">
              <span className="text-orange-500 font-black text-lg md:text-xl uppercase tracking-tighter italic">Total Amount</span>
              <span className="text-orange-500 font-black text-xl md:text-2xl italic">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex gap-3 md:gap-4">
            <button 
              onClick={() => setCart([])}
              className="flex-1 bg-white border-2 border-gray-100 text-gray-400 p-4 md:p-6 rounded-3xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:border-red-100 hover:text-red-500 transition-all"
            >
              Clear Bag
            </button>
            <button 
              onClick={() => setStep('address')}
              className="flex-[2] bg-gray-900 text-white p-4 md:p-6 rounded-3xl font-black text-sm md:text-lg uppercase tracking-widest shadow-2xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              Delivery Details <ChevronRight size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      )}

      {step === 'address' && (
        <div className="space-y-8">
           <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
             Where to? <span className="text-gray-300 font-medium font-serif italic text-lg uppercase tracking-widest">/ Step 2</span>
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
               <div className="flex justify-between items-center px-4">
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Full Address</label>
                 {user.addresses && user.addresses.length > 0 && (
                   <button 
                     onClick={() => setShowSavedAddresses(!showSavedAddresses)}
                     className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600 transition-colors"
                   >
                     {showSavedAddresses ? 'Hide Saved' : 'Use Saved'}
                   </button>
                 )}
               </div>
               
               {showSavedAddresses && user.addresses && (
                 <motion.div 
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="p-4 bg-orange-50 rounded-[28px] border border-orange-100 flex gap-2 overflow-x-auto custom-scrollbar"
                 >
                    {user.addresses.map((addr, idx) => (
                      <button 
                         type="button"
                        key={idx}
                        onClick={() => {
                          setAddress(addr);
                          setShowSavedAddresses(false);
                        }}
                        className="shrink-0 bg-white p-4 rounded-2xl border border-orange-200 text-xs font-bold text-gray-600 hover:border-orange-500 hover:text-orange-500 transition-all shadow-sm max-w-[200px] text-left line-clamp-2"
                      >
                        {addr}
                      </button>
                    ))}
                 </motion.div>
               )}

               <textarea 
                className="w-full p-6 bg-white border border-gray-100 rounded-[32px] outline-none focus:ring-2 focus:ring-orange-500/20 font-semibold min-h-[150px] resize-none shadow-sm"
                placeholder="Apartment, Street, Landmark..."
                value={address}
                onChange={e => setAddress(e.target.value)}
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-4">Phone Number</label>
               <input 
                type="tel"
                className="w-full p-6 bg-white border border-gray-100 rounded-[32px] outline-none focus:ring-2 focus:ring-orange-500/20 font-semibold"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
               />
            </div>
          </div>
           <button 
            onClick={() => setStep('payment')}
            disabled={!address || !phone}
            className="w-full bg-gray-900 text-white p-6 rounded-[32px] font-black text-lg uppercase tracking-widest shadow-2xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            Choose Payment <ChevronRight size={20} />
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-8">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
             Payment <span className="text-gray-300 font-medium font-serif italic text-lg uppercase tracking-widest">/ Final Step</span>
          </h2>
          <div className="grid gap-4">
            <button 
              onClick={() => setPaymentMethod('online')}
              className={cn(
                "flex items-center gap-6 p-8 bg-white border-2 rounded-[32px] shadow-lg transition-all relative overflow-hidden",
                paymentMethod === 'online' ? "border-orange-500 shadow-orange-50" : "border-gray-50 opacity-60"
              )}
            >
               <div className="bg-orange-500 text-white p-3 rounded-2xl"><CreditCard size={24} /></div>
               <div className="text-left">
                  <p className="font-black tracking-tight">Net Banking / UPI</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secure Gateway</p>
               </div>
               {paymentMethod === 'online' && <div className="absolute top-4 right-4"><CheckCircle2 size={24} className="text-orange-500" /></div>}
            </button>
            <button 
              onClick={() => setPaymentMethod('wallet')}
              className={cn(
                "flex items-center gap-6 p-8 bg-white border-2 rounded-[32px] shadow-lg transition-all relative overflow-hidden",
                paymentMethod === 'wallet' ? "border-orange-500 shadow-orange-50" : "border-gray-50 opacity-60"
              )}
            >
               <div className="bg-orange-500 text-white p-3 rounded-2xl"><ShieldCheck size={24} /></div>
               <div className="text-left">
                  <p className="font-black tracking-tight">Tiffin Wallet</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Balance: {formatCurrency(user.wallet || 0)}</p>
               </div>
               {paymentMethod === 'wallet' && <div className="absolute top-4 right-4"><CheckCircle2 size={24} className="text-orange-500" /></div>}
            </button>
          </div>

          <div className="p-8 bg-black/5 rounded-[40px] border border-black/5">
             <div className="flex justify-between items-center">
                <p className="font-black uppercase tracking-widest text-[10px] text-gray-500">Amount to pay</p>
                <p className="font-black text-2xl italic">{formatCurrency(total)}</p>
             </div>
          </div>

          <button 
            onClick={placeOrder}
            disabled={isOrdering}
            className="w-full bg-orange-500 text-white p-8 rounded-[40px] font-black text-2xl uppercase italic tracking-tighter shadow-2xl shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            {isOrdering ? 'Processing...' : `Pay ${formatCurrency(total)}`}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const OrdersView = ({ orders, setActiveOrder }: { orders: Order[], setActiveOrder: (o: Order) => void }) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-2xl font-black tracking-tight">Track Your Tiffin</h2>
      <div className="space-y-6">
        {!Array.isArray(orders) || orders.length === 0 ? (
          <div className="p-12 text-center text-gray-300 font-black italic">No orders yet</div>
        ) : (
          orders.map(order => (
            <div 
              key={order.id} 
              onClick={() => setActiveOrder(order)}
              className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Order ID: #{order.id}</span>
                   <h4 className="font-black tracking-tight text-lg">{order.items.length} items • {formatCurrency(order.total)}</h4>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-dashed border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                <div className="flex items-center gap-2 text-orange-500 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all">
                  View Status <ChevronRight size={14} strokeWidth={3} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

const SupportView = ({ user, messages, socket }: { user: User, messages: ChatMessage[], socket: Socket }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('chat:message', {
      userId: user.id,
      text: input,
      senderName: user.name,
      isAdmin: false
    });
    setInput('');
  };

  const sendQuickReply = (text: string) => {
    socket.emit('chat:message', {
      userId: user.id,
      text,
      senderName: user.name,
      isAdmin: false
    });
  };

  const quickReplies = [
    "Where is my order?",
    "Food was cold",
    "Change address",
    "I want a refund"
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[75vh] flex flex-col bg-white rounded-[40px] shadow-2xl shadow-gray-200 overflow-hidden border border-gray-100 mb-8">
      <div className="p-6 bg-gray-900 text-white flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center"><MessageSquare size={20} /></div>
            <div>
               <h3 className="font-black tracking-tight leading-none">Support Chat</h3>
               <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> We're online</p>
            </div>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        <div className="bg-orange-100 p-5 rounded-3xl rounded-tl-none mr-12 text-sm font-bold text-orange-900 border border-orange-200 leading-relaxed">
           Hello! I'm Tiffin Bot. How can I help you today? Ask me about delivery times, pricing, or order status.
        </div>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "p-5 rounded-3xl text-sm leading-relaxed max-w-[85%]",
              msg.senderId === user.id 
                ? "bg-gray-900 text-white ml-auto rounded-tr-none shadow-lg shadow-gray-200 font-medium" 
                : "bg-white text-gray-900 mr-auto rounded-tl-none border border-gray-100 shadow-sm font-bold"
            )}
          >
            <p className="text-[9px] uppercase tracking-widest mb-2 opacity-50 font-black">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            {msg.text}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {messages.length < 5 && (
        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide border-t border-gray-50 bg-white">
          {quickReplies.map(reply => (
            <button 
              key={reply}
              onClick={() => sendQuickReply(reply)}
              className="whitespace-nowrap bg-gray-50 text-gray-400 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 hover:text-orange-600 border border-gray-100 transition-all active:scale-95"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={sendMessage} className="p-6 bg-white border-t border-gray-100 flex gap-4">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-gray-50 p-4 rounded-2xl border-none outline-none font-semibold focus:ring-2 focus:ring-orange-500/10"
        />
        <button className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg shadow-orange-100 active:scale-90 transition-all">
          <Send size={20} />
        </button>
      </form>
    </motion.div>
  );
};

const ProfileView = ({ user, orders, setUser, onLogout, notificationsEnabled, requestPermission, setActiveTab }: { 
  user: User, 
  orders: Order[],
  setUser: (u: User) => void,
  onLogout: () => void,
  notificationsEnabled: NotificationPermission,
  requestPermission: () => void,
  setActiveTab: (t: string) => void
}) => {
  const [expandedSection, setExpandedSection] = useState<'history' | 'addresses' | null>('history');
  const [editingAddress, setEditingAddress] = useState<{ index: number, text: string } | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editInfo, setEditInfo] = useState({ name: user.name, phone: user.phone || '' });

  const toggleSection = (section: 'history' | 'addresses') => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const saveAddresses = async (updatedAddresses: string[]) => {
    const res = await fetch('/api/auth/profile/addresses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: updatedAddresses })
    });
    if (res.ok) {
      const updatedUser = await res.json();
      setUser(updatedUser);
    }
  };

  const addAddress = () => {
    if (!newAddress.trim()) return;
    const updated = [...(user.addresses || []), newAddress.trim()];
    saveAddresses(updated);
    setNewAddress('');
  };

  const removeAddress = (index: number) => {
    const updated = user.addresses.filter((_, i) => i !== index);
    saveAddresses(updated);
  };

  const startEditing = (index: number) => {
    setEditingAddress({ index, text: user.addresses[index] });
  };

  const finishEditing = () => {
    if (!editingAddress) return;
    const updated = [...user.addresses];
    updated[editingAddress.index] = editingAddress.text.trim();
    saveAddresses(updated);
    setEditingAddress(null);
  };

  const saveProfileInfo = async () => {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editInfo)
    });
    if (res.ok) {
      const updatedUser = await res.json();
      setUser(updatedUser);
      setIsEditingInfo(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-2xl mx-auto space-y-12 pb-20"
    >
      {/* Editorial Header */}
      <div className="relative pt-12 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-400/10 blur-[100px] rounded-full -z-10" />
        <div className="inline-block relative mb-6 group/avatar">
          <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gray-100 mx-auto ring-8 ring-orange-50 relative">
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}&backgroundColor=f97316&textColor=ffffff`} 
              alt={user.name}
            />
            <button 
              onClick={() => setIsEditingInfo(true)}
              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
            >
              <Edit3 size={20} />
              <span className="text-[8px] font-black uppercase tracking-widest">Edit Profile</span>
            </button>
          </div>
        </div>
        
        {isEditingInfo ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xs mx-auto space-y-4">
            <input 
              type="text" 
              value={editInfo.name} 
              onChange={e => setEditInfo({ ...editInfo, name: e.target.value })}
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-center font-black text-xl tracking-tighter outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Your Name"
            />
            <input 
              type="tel" 
              value={editInfo.phone} 
              onChange={e => setEditInfo({ ...editInfo, phone: e.target.value })}
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-center font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Phone Number"
            />
            <div className="flex gap-2">
              <button 
                onClick={saveProfileInfo}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100"
              >
                Update
              </button>
              <button 
                onClick={() => { setIsEditingInfo(false); setEditInfo({ name: user.name, phone: user.phone || '' }); }}
                className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            <h2 className="text-4xl font-black tracking-tighter text-gray-900 mb-2">{user.name}</h2>
            <p className="text-sm font-bold text-gray-400 flex items-center justify-center gap-2">
              <Mail size={14} className="text-orange-500" /> {user.email}
              {user.phone && <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />}
              {user.phone && <Phone size={14} className="text-orange-500" /> } {user.phone}
            </p>
          </>
        )}
        
        <div className="mt-8 flex items-center justify-center gap-4">
           <div className="px-6 py-2 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
             {user.role} Member
           </div>
           <button 
             onClick={requestPermission}
             className={cn(
               "flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
               notificationsEnabled === 'granted' ? "bg-orange-50 text-orange-500" : "bg-gray-100 text-gray-400"
             )}
           >
             <Bell size={14} /> Alerts {notificationsEnabled === 'granted' ? 'ON' : 'OFF'}
           </button>
        </div>
      </div>

      {/* Bento Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6">
        {/* Quick Stats */}
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-900 text-white p-8 rounded-[48px] shadow-xl shadow-gray-200">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
               <TrendingUp size={24} className="text-orange-500" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Total Orders</p>
             <h4 className="text-4xl font-black italic">{orders.length}</h4>
          </div>
          <div className="bg-orange-500 text-white p-8 rounded-[48px] shadow-xl shadow-orange-100">
             <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center mb-6">
               <DollarSign size={24} className="text-white" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-100 mb-1">Total Spent</p>
             <h4 className="text-4xl font-black italic">{formatCurrency(orders.reduce((acc, o) => acc + o.total, 0))}</h4>
          </div>
          <div className="bg-white border border-orange-100 p-8 rounded-[48px] shadow-xl shadow-orange-50">
             <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-6">
               <ShieldCheck size={24} className="text-orange-500" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Wallet Balance</p>
             <h4 className="text-4xl font-black italic text-orange-500">{formatCurrency(user.wallet || 0)}</h4>
          </div>
        </div>

        {/* Order History */}
        <section className="bg-white md:col-span-2 rounded-[48px] border border-gray-100 shadow-xl shadow-gray-200/20 overflow-hidden">
          <button 
            onClick={() => toggleSection('history')}
            className="w-full text-left p-10 border-b border-gray-50 flex items-center justify-between group"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center shadow-inner shadow-orange-100/50">
                <History size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tighter">The Food Log</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{orders.length} Previous Cravings</p>
              </div>
            </div>
            <div className={cn("p-2 rounded-xl bg-gray-50 transition-transform group-hover:bg-orange-50 group-hover:text-orange-500", expandedSection === 'history' && "rotate-180")}>
               <ChevronDown size={20} />
            </div>
          </button>
          
          <AnimatePresence>
            {expandedSection === 'history' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-gray-50/20"
              >
                <div className="p-8 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {orders.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <UtensilsCrossed size={48} className="mx-auto mb-4" />
                    <p className="font-black tracking-tight text-xl">The Plate is Empty</p>
                    <p className="text-sm font-bold mt-1 italic font-serif">Start your culinary journey today.</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <motion.div 
                      layout
                      key={order.id} 
                      className="bg-white p-6 rounded-[32px] border border-gray-100 hover:shadow-xl transition-all group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="text-[9px] font-black text-orange-500/50 uppercase tracking-[0.2em]">RARE_0{order.id.slice(0,4)}</span>
                          <p className="font-black text-lg -mt-1">{new Date(order.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-2xl mb-6 space-y-2">
                        {order.items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[11px] font-bold">
                            <span className="text-gray-500">{it.name} x {it.quantity}</span>
                            <span>{formatCurrency(it.price * it.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-6 border-t border-gray-100/50">
                        <div className="flex items-center gap-4">
                          <span className="text-[11px] font-black text-gray-400 flex items-center gap-2">
                             <MapPin size={12} /> {order.address.split(',')[0]}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab('support');
                              // Logic to prefilled message could go here if support state was complex
                            }}
                            className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:underline"
                          >
                            Support
                          </button>
                        </div>
                        <p className="font-black text-xl text-gray-900 tracking-tighter">{formatCurrency(order.total)}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Saved Addresses */}
        <section className="bg-white md:col-span-1 rounded-[48px] border border-gray-100 shadow-xl shadow-gray-200/20">
          <button 
            onClick={() => toggleSection('addresses')}
            className="w-full text-left p-10 border-b border-gray-50 flex items-center justify-between group"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center shadow-inner shadow-blue-100/50">
                <MapPin size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tighter text-gray-900">Your Base Map</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{user.addresses?.length || 0} Registered Spots</p>
              </div>
            </div>
            <div className={cn("p-2 rounded-xl bg-gray-50 transition-transform group-hover:bg-blue-50 group-hover:text-blue-500", expandedSection === 'addresses' && "rotate-180")}>
               <ChevronDown size={20} />
            </div>
          </button>

          <AnimatePresence>
            {expandedSection === 'addresses' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-gray-50/20"
              >
                <div className="p-10 space-y-4">
                {user.addresses?.map((addr: string, idx: number) => (
                  <div key={idx} className="group relative">
                    {editingAddress?.index === idx ? (
                      <div className="bg-gray-900 p-6 rounded-[32px] shadow-2xl relative z-10">
                        <textarea 
                          autoFocus
                          value={editingAddress.text}
                          onChange={e => setEditingAddress({ ...editingAddress, text: e.target.value })}
                          className="w-full bg-white/10 text-white p-4 rounded-2xl font-bold text-sm outline-none mb-4 min-h-[100px] border border-white/10"
                        />
                        <div className="flex gap-2">
                          <button onClick={finishEditing} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20">Save Spot</button>
                          <button onClick={() => setEditingAddress(null)} className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Abandon</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-[32px] border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all flex justify-between items-start group/addr">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm shrink-0 mt-1">
                            <Navigation2 size={18} />
                          </div>
                          <p className="text-sm font-bold text-gray-600 leading-relaxed font-serif italic pr-12 line-clamp-2">"{addr}"</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/addr:opacity-100 transition-opacity absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/50">
                          <button onClick={() => startEditing(idx)} className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => removeAddress(idx)} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-8 mt-10 border-t-2 border-dashed border-gray-100 flex gap-3">
                   <input 
                     value={newAddress}
                     onChange={e => setNewAddress(e.target.value)}
                     placeholder="Drop a new coordinate..."
                     className="flex-1 p-5 bg-white border border-gray-100 rounded-3xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-300 shadow-sm"
                   />
                   <button 
                     onClick={addAddress}
                     className="bg-gray-900 text-white px-8 rounded-3xl shadow-xl shadow-gray-200 active:scale-95 transition-all"
                   >
                     <Plus size={24} />
                   </button>
                </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <div className="pt-10">
        <button 
          onClick={onLogout}
          className="w-full bg-white border-2 border-red-50 text-red-500 p-10 rounded-[56px] font-black text-sm uppercase tracking-[0.4em] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-xl shadow-red-100/20 flex items-center justify-center gap-6 group"
        >
          <LogOut size={24} className="group-hover:-translate-x-3 transition-transform" /> 
          Sign Out of Tiffin
        </button>
      </div>
    </motion.div>
  );
};
const ToastContainer = ({ toasts }: { toasts: { id: string, title: string, message: string, type: string }[] }) => {
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-6 pointer-events-none space-y-3">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={cn(
              "p-5 rounded-[28px] shadow-2xl pointer-events-auto border flex items-center gap-4",
              toast.type === 'success' ? "bg-white border-green-100" :
              toast.type === 'warning' ? "bg-white border-orange-100" :
              "bg-white border-blue-100"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
              toast.type === 'success' ? "bg-green-50 text-green-500" :
              toast.type === 'warning' ? "bg-orange-50 text-orange-500" :
              "bg-blue-50 text-blue-500"
            )}>
              {toast.type === 'success' ? <CheckCircle2 size={20} /> :
               toast.type === 'warning' ? <BellRing size={20} /> :
               <MessageSquare size={20} />}
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-widest leading-none mb-1">{toast.title}</p>
              <p className="text-[11px] font-bold text-gray-400 line-clamp-2">{toast.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Admin Components
const AdminDashboardView = ({ orders }: { orders: Order[] }) => {
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const stats = {
    revenue: activeOrders.reduce((a, b) => a + b.total, 0),
    active: orders.filter(o => ['pending', 'preparing', 'on-the-way'].includes(o.status)).length,
    growth: 12.5,
    avgOrder: activeOrders.length > 0 ? (activeOrders.reduce((a, b) => a + b.total, 0) / activeOrders.length) : 0
  };

  // Process data for chart (last 7 days)
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    const dayRevenue = orders
      .filter(o => o.createdAt.startsWith(dateStr) && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);
    return {
      date: date.toLocaleDateString([], { weekday: 'short' }),
      revenue: dayRevenue || Math.floor(Math.random() * 1000) + 500 // Mock data for empty days
    };
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-orange-50 shadow-xl shadow-orange-100 flex flex-col items-center text-center overflow-hidden relative">
         <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-orange-500/5 rounded-bl-[60px] sm:rounded-bl-[80px]" />
         <TrendingUp className="text-orange-500 mb-4" size={32} sm:size={40} />
         <h2 className="text-2xl sm:text-4xl font-black tracking-tighter">Control Center</h2>
         <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 italic font-serif">Global Kitchen Logistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div className="bg-white p-5 sm:p-6 rounded-3xl sm:rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 sm:block">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center sm:mb-4 shrink-0"><DollarSign size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Revenue</p>
              <p className="text-xl sm:text-2xl font-black tabular-nums">{formatCurrency(stats.revenue)}</p>
              <div className="flex items-center gap-1 mt-1 text-green-500 font-black text-[9px]">
                 <ArrowUpRight size={10} /> {stats.growth}% Growth
              </div>
            </div>
         </div>
         <div className="bg-white p-5 sm:p-6 rounded-3xl sm:rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 sm:block">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center sm:mb-4 shrink-0"><Package size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Active Orders</p>
              <p className="text-xl sm:text-2xl font-black tabular-nums">{stats.active}</p>
              <p className="text-[9px] font-black text-orange-400 mt-1 uppercase">Live Sync On</p>
            </div>
         </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
         <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-lg tracking-tight">Revenue Trend</h4>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Last 7 Days</span>
         </div>
         <div className="h-64 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                     <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                    itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#f97316" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
         <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full group-hover:scale-125 transition-transform duration-1000" />
         <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4">Operations Insights</p>
         <h4 className="text-white font-black text-2xl tracking-tighter mb-2">Average Ticket Value</h4>
         <p className="text-white/60 text-sm font-bold leading-relaxed mb-6 italic font-serif">"The balance between quality and velocity is the key to culinary scale."</p>
         <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.avgOrder)}</span>
            <span className="bg-white/10 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Per Transaction</span>
         </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
         <h4 className="font-black text-lg mb-6 tracking-tight">Recent Activity Log</h4>
         <div className="space-y-4">
            {orders.slice(0, 5).map(order => (
               <div key={order.id} className="flex items-center justify-between border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-4">
                     <div className="w-2 h-2 rounded-full bg-orange-500" />
                     <div>
                        <p className="font-black text-sm tracking-tight">{order.userName}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {order.items.length} items</p>
                     </div>
                  </div>
                  <StatusBadge status={order.status} />
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const AdminOrdersView = ({ orders, fetchOrders }: { orders: Order[], fetchOrders: () => void }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status } : null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (order.userEmail && order.userEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tighter">Kitchen Feed</h2>
            <div className="mt-2 flex items-center gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 animate-pulse w-fit">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live Updates
              </div>
              <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Total: {orders.length}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
             <div className="relative flex-1 md:min-w-[300px]">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                   type="text"
                   placeholder="Search ID, Name or Email..."
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
                />
             </div>
             
             <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-2xl overflow-x-auto max-w-full custom-scrollbar">
                {(['all', 'pending', 'preparing', 'on-the-way', 'delivered', 'cancelled'] as const).map(f => (
                   <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={cn(
                         "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                         statusFilter === f ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600"
                      )}
                   >
                      {f}
                   </button>
                ))}
             </div>
          </div>
       </div>

       <div className="space-y-6">
          {!Array.isArray(orders) || orders.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[48px] border border-dashed border-gray-200">
               <Package className="mx-auto text-gray-200 mb-4" size={48} />
               <p className="text-gray-300 font-black italic">Feed is empty</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[48px] border border-dashed border-gray-200">
               <Filter className="mx-auto text-gray-200 mb-4" size={48} />
               <p className="text-gray-300 font-black italic">No orders matching your filters</p>
               <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="mt-4 text-orange-500 font-black text-[10px] uppercase tracking-widest">Clear all filters</button>
            </div>
          ) : (
            filteredOrders.map(order => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrder(order)}
              className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-xl shadow-gray-100/50 cursor-pointer hover:scale-[1.01] transition-all"
            >
               <div className="flex justify-between items-start mb-4 md:mb-6">
                  <div>
                     <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">#{order.id}</span>
                     <h4 className="text-lg md:text-xl font-black tracking-tight">{order.userName}</h4>
                     <p className="text-[10px] md:text-xs font-bold text-gray-400 mt-1 line-clamp-1">{order.address}</p>
                  </div>
                  <StatusBadge status={order.status} />
               </div>

               <div className="bg-gray-50 p-4 md:p-6 rounded-3xl md:rounded-[32px] space-y-2 md:space-y-3 mb-6 md:mb-8">
                  {order.items.slice(0, 2).map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs">
                       <span className="font-black text-gray-700 truncate mr-4">x{item.quantity} {item.name}</span>
                       <span className="text-gray-400 font-bold italic shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest text-center mt-2">
                       + {order.items.length - 2} more items
                    </p>
                  )}
                  <div className="pt-3 border-t border-gray-200 flex justify-between font-black text-orange-500 italic text-sm md:text-base">
                     <span>Total Revenue</span>
                     <span>{formatCurrency(order.total)}</span>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-2" onClick={e => e.stopPropagation()}>
                  {[
                    { s: 'preparing', icon: Utensils, label: 'Kitchen' },
                    { s: 'on-the-way', icon: Truck, label: 'Ship' },
                    { s: 'delivered', icon: CheckCircle2, label: 'Done' }
                  ].map(({ s, icon: Icon, label }) => (
                    <button 
                      key={s}
                      onClick={() => updateStatus(order.id, s as OrderStatus)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 p-3 md:p-5 rounded-2xl md:rounded-[28px] transition-all",
                        order.status === s ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      )}
                    >
                      <Icon size={16} className="md:w-5 md:h-5" />
                      <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{label}</span>
                    </button>
                  ))}
               </div>
            </div>
          ))
        )}
       </div>

       {selectedOrder && (
         <AdminOrderDetailsModal 
           order={selectedOrder} 
           onClose={() => setSelectedOrder(null)} 
           onUpdateStatus={updateStatus}
         />
       )}
    </div>
  );
};

const AdminSupportView = ({ user, messages, socket }: { user: User, messages: ChatMessage[], socket: Socket }) => {
  const [activeUserChat, setActiveUserChat] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  
  // Group messages by user
  const grouped = Array.isArray(messages) ? messages.reduce((acc, msg) => {
    const id = msg.senderId === user.id ? 'admin' : msg.senderId;
    if (id === 'admin') return acc;
    if (!acc[id]) acc[id] = [];
    acc[id].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>) : {};

  const filteredUserIds = Object.keys(grouped).filter(uId => 
    grouped[uId][0].senderName.toLowerCase().includes(search.toLowerCase())
  );

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeUserChat) return;
    socket.emit('chat:message', {
      userId: activeUserChat,
      text: input,
      senderName: 'Admin',
      isAdmin: true
    });
    setInput('');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter">Support Desk</h2>
        <div className="relative w-full sm:w-64 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-100 p-4 pl-12 rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-orange-500/10 shadow-sm"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[70vh] md:h-[65vh]">
        {/* User List - Hide on mobile if a chat is active */}
        <div className={cn(
          "col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar",
          activeUserChat ? "hidden md:block" : "block"
        )}>
           {filteredUserIds.length === 0 ? (
             <div className="p-10 text-center bg-white rounded-[32px] border border-dashed border-gray-100 text-gray-300 font-bold italic text-sm">
                No active tickets
             </div>
           ) : (
             filteredUserIds.map(uId => (
               <button 
                key={uId}
                onClick={() => setActiveUserChat(uId)}
                className={cn(
                  "w-full p-6 rounded-[32px] text-left transition-all border",
                  activeUserChat === uId ? "bg-orange-500 text-white border-orange-500 shadow-xl shadow-orange-100" : "bg-white border-gray-100 text-gray-900 shadow-sm"
                )}
               >
                 <h4 className="font-black tracking-tight line-clamp-1">{grouped[uId][0].senderName}</h4>
                 <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", activeUserChat === uId ? "text-orange-100" : "text-gray-400")}>
                   {grouped[uId].length} messages
                 </p>
               </button>
             ))
           )}
        </div>
        
        {/* Chat Window - Show on mobile only if a chat is active */}
        <div className={cn(
          "col-span-1 md:col-span-2 h-full flex flex-col bg-white rounded-[40px] md:rounded-[48px] shadow-2xl shadow-gray-200 overflow-hidden border border-gray-100 transition-all",
          activeUserChat ? "block" : "hidden md:flex items-center justify-center font-black italic text-gray-200 text-2xl"
        )}>
          {activeUserChat ? (
            <>
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between md:hidden">
                <button 
                  onClick={() => setActiveUserChat(null)}
                  className="p-2 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100"
                >
                  <X size={20} />
                </button>
                <span className="font-black text-xs uppercase tracking-widest">{grouped[activeUserChat]?.[0]?.senderName}</span>
                <div className="w-10" />
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                 {messages.filter(m => m.senderId === activeUserChat || (m.isAdmin && activeUserChat)).map(msg => (
                    <div key={msg.id} className={cn(
                      "p-4 rounded-3xl max-w-[85%] md:max-w-[80%]",
                      msg.isAdmin ? "bg-gray-900 text-white ml-auto rounded-tr-none" : "bg-gray-100 text-gray-900 mr-auto rounded-tl-none"
                    )}>
                      <p className="text-[8px] font-bold uppercase mb-2 opacity-50">{msg.senderName}</p>
                      <p className="font-semibold text-sm leading-relaxed">{msg.text}</p>
                    </div>
                 ))}
              </div>
              <form onSubmit={sendMessage} className="p-4 md:p-6 bg-gray-50 border-t border-gray-100 flex gap-3 md:gap-4">
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Reply to user..."
                  className="flex-1 bg-white p-4 md:p-5 rounded-2xl border-none outline-none font-semibold shadow-sm text-sm"
                />
                <button className="bg-orange-500 text-white p-4 md:p-5 rounded-2xl shadow-xl shadow-orange-100 active:scale-95 transition-all">
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            "Select a user to chat"
          )}
        </div>
      </div>
    </div>
  );
};

const AdminUsersView = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [confirmingRole, setConfirmingRole] = useState<{ userId: string, newRole: UserRole } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRoleClick = (userId: string, currentRole: UserRole) => {
    setConfirmingRole({ userId, newRole: currentRole === 'admin' ? 'user' : 'admin' });
  };

  const confirmToggleRole = async () => {
    if (!confirmingRole) return;
    const { userId, newRole } = confirmingRole;
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: data.newRole } : u));
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, role: data.newRole } : null);
        }
      }
    } catch (err) {
      console.error('Failed to toggle role', err);
    } finally {
      setConfirmingRole(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h2 className="text-3xl font-black tracking-tighter text-gray-900 flex items-center gap-4 whitespace-nowrap">
          Community <span className="text-orange-500 italic">Core</span>
        </h2>
        
        <div className="flex flex-1 w-full max-w-2xl gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or email..."
              className="w-full bg-white pl-14 pr-6 py-4 rounded-3xl border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-orange-500/10 font-bold text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative group">
            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={16} />
            <select 
              className="bg-white pl-12 pr-10 py-4 rounded-3xl border border-gray-100 shadow-sm outline-none appearance-none font-black text-[10px] uppercase tracking-widest cursor-pointer hover:border-orange-500 transition-all"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
            >
              <option value="all">Every Role</option>
              <option value="user">Standard Users</option>
              <option value="admin">Administrators</option>
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={14} />
          </div>
          
          <div className="bg-gray-100 px-6 py-4 rounded-3xl flex items-center gap-3 shrink-0">
            <Users size={16} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{users.length} Total</span>
          </div>
        </div>
      </div>

      {filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <div 
              key={user.id} 
              onClick={() => setSelectedUser(user)}
              className="group bg-white p-6 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100/50 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden"
            >
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-orange-500 font-black text-xl border border-gray-100 shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-lg font-black tracking-tight text-gray-900 truncate">{user.name}</h4>
                    {user.role === 'admin' && <ShieldAlert size={12} className="text-orange-500" />}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleRoleClick(user.id, user.role);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
                    user.role === 'admin' ? "bg-gray-900 text-white shadow-gray-200" : "bg-orange-500 text-white shadow-orange-100"
                  )}
                  title={`Demote to ${user.role === 'admin' ? 'user' : 'admin'}`}
                >
                  {user.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between relative z-10">
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full",
                  user.role === 'admin' ? "bg-gray-900 text-white" : "bg-orange-50 text-orange-500 border border-orange-100"
                )}>
                  {user.role} Status
                </span>
                <div className="flex -space-x-1">
                   {user.addresses?.slice(0, 3).map((_, i) => (
                     <div key={i} className="w-2 h-2 rounded-full bg-gray-200 border border-white" />
                   ))}
                   {user.addresses?.length > 3 && <span className="text-[8px] font-bold text-gray-300 ml-1">+{user.addresses.length - 3}</span>}
                </div>
              </div>

              {/* Ambient Background Glow */}
              <div className={cn(
                "absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-10 transition-all group-hover:opacity-20",
                user.role === 'admin' ? "bg-orange-600" : "bg-blue-600"
              )} />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-gray-50 rounded-[56px] border-2 border-dashed border-gray-100">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-gray-200 mb-6 shadow-sm">
            <Search size={32} />
          </div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">No members match your search</h3>
          <p className="text-sm font-bold text-gray-400 mt-2">Try adjusting your filters or search terms</p>
          <button 
            onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
            className="mt-8 text-orange-500 font-black text-[10px] uppercase tracking-widest hover:underline"
          >
            Clear All Filters
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal 
            user={selectedUser} 
            onClose={() => setSelectedUser(null)}
            onToggleRole={() => handleToggleRoleClick(selectedUser.id, selectedUser.role)}
          />
        )}

        {confirmingRole && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] p-10 w-full max-w-sm text-center shadow-2xl overflow-hidden relative"
            >
              <div className={cn(
                "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 shadow-xl",
                confirmingRole.newRole === 'admin' ? "bg-orange-500 text-white shadow-orange-100" : "bg-gray-900 text-white shadow-gray-200"
              )}>
                {confirmingRole.newRole === 'admin' ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
              </div>
              <h3 className="text-2xl font-black tracking-tight text-gray-900 mb-2">Upgrade Permissions?</h3>
              <p className="text-sm font-bold text-gray-400 leading-relaxed mb-10">
                Are you sure you want to change this user's role to <span className="text-gray-900 font-black uppercase tracking-widest text-xs italic">{confirmingRole.newRole}</span>?
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmingRole(null)}
                  className="flex-1 p-5 rounded-2xl bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
                >
                  Regret
                </button>
                <button 
                  onClick={confirmToggleRole}
                  className="flex-1 p-5 rounded-2xl bg-gray-900 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-gray-200 active:scale-95 transition-all"
                >
                  Confirm
                </button>
              </div>
              
              {/* Absolutes */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-gray-900" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserDetailModal = ({ user, onClose, onToggleRole }: { user: User, onClose: () => void, onToggleRole: () => void }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-[56px] w-full max-w-lg overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-10 right-10 text-gray-400 hover:text-gray-900 transition-colors z-20">
          <X size={28} />
        </button>

        <div className="p-12">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-24 h-24 bg-orange-50 rounded-[40px] flex items-center justify-center text-orange-500 text-4xl font-black mb-6 relative">
              {user.name.charAt(0)}
              <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                {user.role === 'admin' ? <ShieldAlert className="text-orange-500" size={20} /> : <ShieldCheck className="text-gray-400" size={20} />}
              </div>
            </div>
            <h3 className="text-3xl font-black tracking-tighter text-gray-900">{user.name}</h3>
            <p className="text-xs font-black text-orange-500 uppercase tracking-widest mt-2 bg-orange-50 px-3 py-1 rounded-full">
              {user.role} Status
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-sm text-gray-900 break-all">{user.email}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone</p>
                <p className="font-bold text-sm text-gray-900">{user.phone || 'Not Shared'}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Primary Account Addresses</p>
              <div className="space-y-3">
                {user.addresses && user.addresses.length > 0 ? (
                  user.addresses.map((addr, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mt-0.5">
                        <MapPin size={14} />
                      </div>
                      <p className="text-xs font-bold text-gray-600 flex-1 leading-relaxed">{addr}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-bold text-gray-300 italic">No addresses saved yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button 
              onClick={onToggleRole}
              className={cn(
                "flex-1 p-6 rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all",
                user.role === 'admin' ? "bg-gray-900 text-white" : "bg-orange-500 text-white shadow-xl shadow-orange-100"
              )}
            >
              <Users size={18} />
              Toggle {user.role === 'admin' ? 'to User' : 'to Admin'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Modals & Helpers
const OrderTrackerModal = ({ order, onClose }: { order: Order, onClose: () => void }) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const steps = [
    { s: 'pending', icon: Package, text: 'Order Placed' },
    { s: 'preparing', icon: Utensils, text: 'In Kitchen' },
    { s: 'on-the-way', icon: Truck, text: 'Out for Delivery' },
    { s: 'delivered', icon: CheckCircle2, text: 'Arrived' }
  ];
  
  const currentStep = steps.findIndex(s => s.s === order.status);

  const handleCancel = async () => {
    await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-[48px] overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors"><X size={24} /></button>
        
        <div className="p-10 pt-16">
          <div className="text-center mb-10">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-1">Live Tracking • #{order.id}</span>
              <h2 className="text-3xl font-black tracking-tight mb-2">Almost there!</h2>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Est. arrival: 25 mins</p>
           </div>

           <div className="space-y-12 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
              {steps.map((step, idx) => {
                const isPast = idx < currentStep;
                const isCurrent = idx === currentStep;
                
                return (
                  <div key={step.s} className="flex items-center gap-6 relative">
                     <div className={cn(
                       "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500",
                       isPast || isCurrent ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "bg-white border-2 border-gray-100 text-gray-200"
                     )}>
                        <step.icon size={18} strokeWidth={3} />
                     </div>
                     <div className={cn(
                       "flex-1 transition-all duration-500",
                       isCurrent ? "scale-105" : ""
                     )}>
                        <p className={cn(
                          "font-black tracking-tighter text-lg leading-none",
                          isPast || isCurrent ? "text-gray-900" : "text-gray-200"
                        )}>{step.text}</p>
                        {isCurrent && <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-1 animate-pulse">In Progress</p>}
                     </div>
                  </div>
                );
              })}
           </div>

           <div className="mt-12 bg-gray-50 -mx-10 p-10 flex gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm"><Truck size={24} /></div>
              <div>
                 <p className="font-black tracking-tight text-sm">Rahul is on his way</p>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact: +91 91234 56789</p>
              </div>
           </div>
           
           {order.status === 'pending' && (
             <button 
               onClick={() => setShowCancelConfirm(true)}
               className="mt-6 w-full p-4 rounded-2xl bg-red-50 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-50"
             >
               Cancel Request
             </button>
           )}
        </div>
      </motion.div>

      <ConfirmationModal 
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title="Cancel Order?"
        message="Running away? If you cancel now, your stomach might hold a grudge. Also, refunds can take up to 48 hours to reflect in your wallet."
        confirmText="Yes, Cancel it"
      />
    </div>
  );
};

const AdminMenuView = ({ menu, fetchMenu }: { menu: MenuItem[], fetchMenu: () => void }) => {
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.imageUrl) {
        setEditing(prev => ({ ...prev, image: data.imageUrl }));
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !editing?.id;
    const url = isNew ? '/api/menu' : `/api/menu/${editing?.id}`;
    const method = isNew ? 'POST' : 'PATCH';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing)
    });
    fetchMenu();
    setEditing(null);
  };

  const deleteItem = async () => {
    if (deletingId) {
      await fetch(`/api/menu/${deletingId}`, { method: 'DELETE' });
      fetchMenu();
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">Menu Vault</h2>
        <button 
          onClick={() => setEditing({ name: '', price: 0, description: '', category: 'lunch', image: '' })}
          className="bg-gray-900 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
        >
          <Plus size={16} /> New Item
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {menu.map(item => (
          <div key={item.id} className="bg-white p-4 md:p-6 rounded-[28px] md:rounded-[32px] border border-gray-100 flex gap-4 md:gap-6 items-center group">
            <img src={item.image} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shadow-lg" referrerPolicy="no-referrer" />
            <div className="flex-1 min-w-0">
              <span className="text-[8px] md:text-[9px] font-black text-orange-500 uppercase tracking-widest">{item.category}</span>
              <h4 className="font-black text-base md:text-lg -mt-1 truncate">{item.name}</h4>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-0.5 md:mt-1 line-clamp-1">{item.description}</p>
              <p className="font-black text-orange-500 italic mt-1 md:mt-2">{formatCurrency(item.price)}</p>
            </div>
            <div className="flex flex-col gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(item)} className="p-2 md:p-3 bg-gray-50 text-gray-900 rounded-xl hover:bg-orange-50 hover:text-orange-500"><Utensils size={14} className="md:w-4 md:h-4" /></button>
              <button onClick={() => setDeletingId(item.id)} className="p-2 md:p-3 bg-gray-50 text-red-500 rounded-xl hover:bg-red-50"><X size={14} className="md:w-4 md:h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={deleteItem}
        title="Delete Item?"
        message="Are you sure you want to remove this dish from the menu? This action cannot be undone."
        confirmText="Internal Delete"
        type="danger"
      />

      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-[48px] p-10 relative shadow-2xl"
            >
              <button onClick={() => setEditing(null)} className="absolute top-8 right-8 text-gray-400"><X size={24} /></button>
              <h3 className="text-2xl font-black tracking-tighter mb-8">{editing.id ? 'Refine Item' : 'Source New Dish'}</h3>
              
              <form onSubmit={saveItem} className="space-y-4">
                <input 
                  type="text" placeholder="Dish Name" 
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/10"
                  value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                />
                <div className="flex gap-4">
                  <input 
                    type="number" placeholder="Price" 
                    className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none"
                    value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                  <select 
                    className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none"
                    value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as any })}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  </select>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-all overflow-hidden relative"
                >
                  {editing.image ? (
                    <div className="w-full h-full relative group">
                      <img src={editing.image} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload className="text-white" size={24} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="text-gray-300 mb-2" size={32} />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center px-4">Tap to upload a mouth-watering image</span>
                    </>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*" 
                />

                <textarea 
                  placeholder="Appetizing description..." 
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none h-24"
                  value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                />
                <button className="w-full bg-orange-500 text-white p-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-orange-100">
                  Seal the Deal
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    'pending': 'bg-gray-100 text-gray-900',
    'preparing': 'bg-orange-100 text-orange-700',
    'on-the-way': 'bg-blue-100 text-blue-700',
    'delivered': 'bg-green-100 text-green-700',
    'cancelled': 'bg-red-100 text-red-700'
  };
  return (
    <span className={cn(
      "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest italic",
      styles[status]
    )}>{status.replace('-', ' ')}</span>
  );
};

const AdminOrderDetailsModal = ({ order, onClose, onUpdateStatus }: { 
  order: Order, 
  onClose: () => void,
  onUpdateStatus: (id: string, s: OrderStatus) => void
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const handleCancel = async () => {
    await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-[48px] overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors z-10"><X size={24} /></button>
        
        <div className="p-10">
          <div className="flex items-center gap-4 mb-8">
             <div className="w-16 h-16 bg-orange-500 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-orange-100">
                <Package size={32} />
             </div>
             <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Detailed Log • #{order.id}</span>
                <h2 className="text-3xl font-black tracking-tighter leading-tight">Order Details</h2>
             </div>
          </div>

          <div className="space-y-6 mb-8">
             <div className="p-8 bg-orange-50/50 rounded-[40px] border border-orange-100 flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-orange-500/5 rounded-full" />
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Primary Customer</p>
                <h4 className="font-black text-2xl tracking-tighter leading-none">{order.userName}</h4>
                <div className="flex flex-col gap-1 mt-2">
                   <p className="text-sm font-bold text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> {order.userEmail}
                   </p>
                   <p className="text-sm font-bold text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> {order.phone}
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Order Status</p>
                   <StatusBadge status={order.status} />
                   <p className="text-[9px] font-black text-gray-400 mt-2 uppercase tracking-tighter">Live Sync: Active</p>
                </div>
                <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Placement Time</p>
                   <div className="space-y-1">
                      <p className="font-black text-sm leading-none">{new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                      <p className="font-bold text-[11px] text-orange-500 italic">{new Date(order.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 mb-8">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Delivery Address</p>
             <p className="font-bold text-sm leading-relaxed">{order.address}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-[40px] overflow-hidden shadow-sm mb-8">
             <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                <p className="font-black text-xs uppercase tracking-widest">Itemized Breakdown</p>
             </div>
             <div className="p-6 space-y-4 max-h-[25vh] overflow-y-auto">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-50">
                     <div className="flex items-center gap-4">
                        <img src={item.image} className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        <div>
                           <p className="font-black text-sm">{item.name}</p>
                           <p className="text-[10px] font-bold text-gray-400">Qty: {item.quantity} • {formatCurrency(item.price)}/ea</p>
                        </div>
                     </div>
                     <span className="font-black italic text-sm">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
             </div>
             <div className="p-6 bg-orange-50 pt-6 flex justify-between items-center">
                <span className="font-black uppercase tracking-tighter text-orange-950">Total Settlement</span>
                <span className="font-black text-2xl text-orange-600 italic">{formatCurrency(order.total)}</span>
             </div>
          </div>

          <div className="flex gap-3 pt-2">
             {[
               { s: 'preparing', icon: Utensils, label: 'Kitchen' },
               { s: 'on-the-way', icon: Truck, label: 'Dispatch' },
               { s: 'delivered', icon: CheckCircle2, label: 'Delivered' }
             ].map(({ s, icon: Icon, label }) => (
               <button 
                 key={s}
                 onClick={() => onUpdateStatus(order.id, s as OrderStatus)}
                 className={cn(
                   "flex-1 flex flex-col items-center gap-2 p-4 rounded-[24px] transition-all",
                   order.status === s ? "bg-orange-500 text-white shadow-xl shadow-orange-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                 )}
               >
                 <Icon size={18} />
                 <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
               </button>
             ))}
             {order.status !== 'cancelled' && order.status !== 'delivered' && (
               <button 
                 onClick={() => setShowCancelConfirm(true)}
                 className="flex flex-col items-center gap-2 p-4 rounded-[24px] bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all min-w-[80px]"
               >
                 <X size={18} />
                 <span className="text-[8px] font-black uppercase tracking-widest">Cancel</span>
               </button>
             )}
          </div>
        </div>
      </motion.div>

      <ConfirmationModal 
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title="Void this Order?"
        message="This action will permanently cancel the order. If the user paid via wallet, the amount will be refunded immediately."
        confirmText="Confirm Void"
      />
    </div>
  );
};

const AdminSettingsView = ({ addToast }: { addToast: (title: string, message: string, type: 'info' | 'success' | 'warning') => void }) => {
  const [settings, setSettings] = useState<AdminSettings>({
    razorpay: { keyId: '', keySecret: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save');
      addToast('Settings Saved', 'Razorpay configuration has been updated.', 'success');
    } catch (err) {
      addToast('Error', 'Could not update settings.', 'warning');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 md:space-y-8 pb-32">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">
          Master <span className="text-orange-500 italic">Settings</span>
        </h2>
        <p className="text-gray-400 font-bold uppercase text-[9px] md:text-[10px] tracking-[0.2em]">Global Configuration & Integrations</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6 overflow-hidden relative">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl" />
          
          <div className="flex items-center gap-4 mb-2 relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center">
              <CreditCard size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg md:text-xl tracking-tight leading-tight">Razorpay Integration</h3>
              <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Gateway Credentials</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-2 md:pt-4 relative z-10">
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Key ID</label>
              <input 
                type="text" 
                placeholder="rzp_test_..."
                className="w-full bg-gray-50 px-5 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-orange-500/10 font-bold text-sm"
                value={settings.razorpay.keyId}
                onChange={e => setSettings({ ...settings, razorpay: { ...settings.razorpay, keyId: e.target.value }})}
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Key Secret</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="w-full bg-gray-50 px-5 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-orange-500/10 font-bold text-sm"
                value={settings.razorpay.keySecret}
                onChange={e => setSettings({ ...settings, razorpay: { ...settings.razorpay, keySecret: e.target.value }})}
              />
            </div>
          </div>

          <div className="p-5 md:p-6 bg-orange-50 rounded-2xl md:rounded-3xl border border-orange-100 relative z-10">
            <p className="text-[10px] md:text-[11px] font-bold text-orange-800 leading-relaxed">
              <span className="font-black uppercase mr-2 text-[8px] md:text-[9px] bg-orange-200 px-1.5 py-0.5 rounded italic">Security Note:</span>
              Your credentials are used server-side for processing payments. Never share your Key Secret with anyone.
            </p>
          </div>
        </div>

        <button 
          disabled={saving}
          type="submit"
          className={cn(
            "w-full md:w-auto bg-gray-900 text-white px-10 md:px-12 py-4 md:py-5 rounded-2xl md:rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50",
            saving && "animate-pulse"
          )}
        >
          {saving ? 'Transmitting...' : 'Apply Configurations'}
        </button>
      </form>
    </motion.div>
  );
};
