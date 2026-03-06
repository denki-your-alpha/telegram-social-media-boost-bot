const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot_data.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      username TEXT,
      balance REAL DEFAULT 0,
      banned INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Redeem codes table
    db.run(`CREATE TABLE IF NOT EXISTS redeem_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      amount REAL,
      max_uses INTEGER,
      redeemed_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // User redeem history table
    db.run(`CREATE TABLE IF NOT EXISTS user_redeems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      code TEXT,
      redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(chat_id)
    )`);

    // Boost prices table
    db.run(`CREATE TABLE IF NOT EXISTS boost_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      type TEXT,
      price REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, type)
    )`);

    // Channels table
    db.run(`CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admins table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      is_temp INTEGER DEFAULT 1,
      added_by INTEGER,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tutorials table
    db.run(`CREATE TABLE IF NOT EXISTS tutorials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link TEXT UNIQUE,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bank details table
    db.run(`CREATE TABLE IF NOT EXISTS bank_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      bank_name TEXT,
      account_number TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // User state table
    db.run(`CREATE TABLE IF NOT EXISTS user_states (
      chat_id INTEGER PRIMARY KEY,
      state TEXT,
      data TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(chat_id)
    )`);

    // API keys table
    db.run(`CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  });
};

// Redeem functions
const getRedeemCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM redeem_codes WHERE code = ?', [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const checkUserRedeemCode = (userId, code) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_redeems WHERE user_id = ? AND code = ?', [userId, code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const recordRedeemCode = (userId, code) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO user_redeems (user_id, code) VALUES (?, ?)', [userId, code], (err) => {
      if (err) reject(err);
      else {
        db.run('UPDATE redeem_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?', [code], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  });
};

const createRedeemCode = (code, amount, maxUses) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO redeem_codes (code, amount, max_uses) VALUES (?, ?, ?)', 
      [code, amount, maxUses], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// User balance functions
const addUserBalance = (userId, amount) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET balance = balance + ? WHERE chat_id = ?', [amount, userId], function(err) {
      if (err) reject(err);
      else if (this.changes === 0) {
        // User doesn't exist, create them
        db.run('INSERT INTO users (chat_id, balance) VALUES (?, ?)', [userId, amount], (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
};

const getUserBalance = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT balance FROM users WHERE chat_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.balance : 0);
    });
  });
};

const updateUserBalance = (userId, newBalance) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET balance = ? WHERE chat_id = ?', [newBalance, userId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Boost price functions
const updateBoostPrice = (platform, type, price) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO boost_prices (platform, type, price) VALUES (?, ?, ?)',
      [platform, type, price],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Channel functions
const addChannel = (username) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO channels (username) VALUES (?)', [username], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const getChannels = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM channels', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Admin functions
const addTempAdmin = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO admins (user_id, is_temp) VALUES (?, 1)', [userId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const isTempAdmin = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM admins WHERE user_id = ? AND is_temp = 1', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
};

const deleteTempAdmin = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM admins WHERE user_id = ? AND is_temp = 1', [userId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Tutorial functions
const addTutorial = (link) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO tutorials (link) VALUES (?)', [link], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const deleteTutorial = (tutorialId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM tutorials WHERE id = ?', [tutorialId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const getTutorials = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM tutorials', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Bank details functions
const updateBankDetails = (adminId, bankName, accountNumber) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO bank_details (admin_id, bank_name, account_number) VALUES (?, ?, ?)',
      [adminId, bankName, accountNumber], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// API key functions
const updateApiKey = (apiKey) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM api_keys', (err) => {
      if (err) reject(err);
      else {
        db.run('INSERT INTO api_keys (api_key) VALUES (?)', [apiKey], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  });
};

const getApiKey = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT api_key FROM api_keys LIMIT 1', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.api_key : null);
    });
  });
};

// User state functions
const setUserState = (userId, state, data = null) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO user_states (chat_id, state, data) VALUES (?, ?, ?)',
      [userId, state, JSON.stringify(data)], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const getUserState = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_states WHERE chat_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? { state: row.state, data: JSON.parse(row.data) } : null);
    });
  });
};

// Transaction functions
const recordTransaction = (userId, type, amount, details = null) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO transactions (user_id, type, amount, details) VALUES (?, ?, ?, ?)',
      [userId, type, amount, details], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Ban/Unban functions
const banUser = (userIdentifier) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET banned = 1 WHERE chat_id = ? OR username = ?',
      [userIdentifier, userIdentifier], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const unbanUser = (userIdentifier) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET banned = 0 WHERE chat_id = ? OR username = ?',
      [userIdentifier, userIdentifier], (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Get all users
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users WHERE banned = 0', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Plan functions
const getPlanDetails = (planId) => {
  return new Promise((resolve, reject) => {
    // This would be implemented based on your API structure
    // For now, returning a mock structure
    resolve({ id: planId, amount: 100, size: '100MB' });
  });
};

// Initialize database
initDatabase();

module.exports = {
  getRedeemCode,
  checkUserRedeemCode,
  recordRedeemCode,
  createRedeemCode,
  addUserBalance,
  getUserBalance,
  updateUserBalance,
  updateBoostPrice,
  addChannel,
  getChannels,
  addTempAdmin,
  isTempAdmin,
  deleteTempAdmin,
  addTutorial,
  deleteTutorial,
  getTutorials,
  updateBankDetails,
  updateApiKey,
  getApiKey,
  setUserState,
  getUserState,
  recordTransaction,
  banUser,
  unbanUser,
  getAllUsers,
  getPlanDetails
};
