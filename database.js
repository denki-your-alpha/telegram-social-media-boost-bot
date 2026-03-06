const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, 'data');
const usersFile = path.join(dbDir, 'users.json');
const ordersFile = path.join(dbDir, 'orders.json');
const topupsFile = path.join(dbDir, 'topups.json');

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize files if they don't exist
[usersFile, ordersFile, topupsFile].forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
  }
});

const db = {
  // User operations
  getUser: (userId) => {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    return users.find(u => u.id === userId);
  },

  getAllUsers: () => {
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  },

  createUser: (userId, username, firstName) => {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const user = {
      id: userId,
      username: username,
      name: firstName,
      balance: 0,
      verified: false,
      totalReferrals: 0,
      totalOrders: 0,
      referrerId: null,
      joinedAt: new Date(),
      banned: false
    };
    users.push(user);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    return user;
  },

  updateUser: (userId, userData) => {
    let users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    users = users.map(u => u.id === userId ? { ...u, ...userData } : u);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  },

  banUser: (userId) => {
    const user = db.getUser(userId);
    if (user) {
      user.banned = true;
      db.updateUser(userId, user);
    }
  },

  unbanUser: (userId) => {
    const user = db.getUser(userId);
    if (user) {
      user.banned = false;
      db.updateUser(userId, user);
    }
  },

  // Order operations
  addOrder: (order) => {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  },

  getAllOrders: () => {
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  },

  getOrder: (orderId) => {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    return orders.find(o => o.id === orderId);
  },

  updateOrder: (orderId, orderData) => {
    let orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    orders = orders.map(o => o.id === orderId ? { ...o, ...orderData } : o);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  },

  // Topup operations
  addTopup: (topup) => {
    const topups = JSON.parse(fs.readFileSync(topupsFile, 'utf8'));
    topups.push(topup);
    fs.writeFileSync(topupsFile, JSON.stringify(topups, null, 2));
  },

  getTopup: (topupId) => {
    const topups = JSON.parse(fs.readFileSync(topupsFile, 'utf8'));
    return topups.find(t => t.id === topupId);
  },

  updateTopup: (topupId, topupData) => {
    let topups = JSON.parse(fs.readFileSync(topupsFile, 'utf8'));
    topups = topups.map(t => t.id === topupId ? { ...t, ...topupData } : t);
    fs.writeFileSync(topupsFile, JSON.stringify(topups, null, 2));
  },

  getAllTopups: () => {
    return JSON.parse(fs.readFileSync(topupsFile, 'utf8'));
  }
};

module.exports = db;
