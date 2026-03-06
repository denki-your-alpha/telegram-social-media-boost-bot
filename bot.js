const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const db = require('./database');
const handlers = require('./handlers');
const utils = require('./utils');
const config = require('./config.json');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware
bot.use((ctx, next) => {
  ctx.state.config = config;
  ctx.state.db = db;
  return next();
});

// ============ START COMMAND ============
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'User';
  const firstName = ctx.from.first_name || 'Friend';

  // Check if user exists
  let user = db.getUser(userId);
  if (!user) {
    user = db.createUser(userId, username, firstName);
  }

  // Check required channels
  const requiredChannels = config.required_channels;
  let allJoined = true;
  const channelLinks = [];

  for (const channel of requiredChannels) {
    try {
      const member = await ctx.telegram.getChatMember(channel.id, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        allJoined = false;
        channelLinks.push(channel);
      }
    } catch (error) {
      allJoined = false;
      channelLinks.push(channel);
    }
  }

  if (!allJoined) {
    const buttons = channelLinks.map(ch => [
      Markup.button.url(`📱 ${ch.name}`, `https://t.me/${ch.username}`)
    ]);
    buttons.push([Markup.button.callback('✅ I Followed', 'verified')]);

    return ctx.reply(
      '🔐 *You must join our channels first!*\n\nClick the buttons below to join:',
      Markup.inlineKeyboard(buttons),
      { parse_mode: 'Markdown' }
    );
  }

  // User verified - show main menu
  await handlers.showMainMenu(ctx, user);
});

// ============ CALLBACK QUERIES ============
bot.action('verified', async (ctx) => {
  const userId = ctx.from.id;
  let user = db.getUser(userId);

  if (!user) {
    return ctx.reply('❌ User not found. Please use /start first.');
  }

  // Verify channels again
  const requiredChannels = config.required_channels;
  let allJoined = true;

  for (const channel of requiredChannels) {
    try {
      const member = await ctx.telegram.getChatMember(channel.id, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        allJoined = false;
        break;
      }
    } catch (error) {
      allJoined = false;
      break;
    }
  }

  if (!allJoined) {
    return ctx.reply('❌ You have not joined all channels yet. Please try again.');
  }

  user.verified = true;
  db.updateUser(userId, user);
  await ctx.answerCbQuery('✅ Verified!');
  await handlers.showMainMenu(ctx, user);
});

bot.action('menu', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await handlers.showMainMenu(ctx, user);
});

bot.action('boost', async (ctx) => {
  await handlers.showBoostMenu(ctx);
});

bot.action('topup', async (ctx) => {
  await handlers.showTopupMenu(ctx);
});

bot.action('referral', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await handlers.showReferralMenu(ctx, user);
});

bot.action('help', async (ctx) => {
  await handlers.showHelp(ctx);
});

bot.action('tutorial', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '📚 *Tutorial*\n\n' +
    'Check out our full tutorial guide here: https://your-tutorial-link.com\n\n' +
    'Contact us: @d3nki_dev',
    { parse_mode: 'Markdown' }
  );
});

bot.action('admin', async (ctx) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (ctx.from.id !== adminId) {
    return ctx.answerCbQuery('❌ Unauthorized', true);
  }
  await handlers.showAdminMenu(ctx);
});

// ============ BOOST COMMANDS ============
bot.command('boost', async (ctx) => {
  await handlers.showBoostMenu(ctx);
});

bot.action(/boost_service_(.+)/, async (ctx) => {
  const serviceId = ctx.match[1];
  const user = db.getUser(ctx.from.id);
  
  if (!user) {
    return ctx.reply('❌ User not found. Please use /start first.');
  }

  const service = config.prices.find(s => s.id === serviceId);
  if (!service) {
    return ctx.answerCbQuery('❌ Service not found', true);
  }

  if (user.balance < service.price) {
    return ctx.reply(
      `❌ Insufficient balance!\n\n` +
      `Need: ₦${service.price}\n` +
      `Your balance: ₦${user.balance}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💰 Top-up', 'topup')],
        [Markup.button.callback('⬅️ Back', 'boost')]
      ])
    );
  }

  ctx.scene = { step: 'waiting_link', service: service };
  await ctx.reply(
    `📋 *Boost Service: ${service.name}*\n\n` +
    `Price: ₦${service.price}\n` +
    `Quantity: ${service.quantity}\n\n` +
    `Send me the link to boost:`
  );
});

bot.on('text', async (ctx) => {
  if (ctx.scene && ctx.scene.step === 'waiting_link') {
    const link = ctx.message.text;
    const userId = ctx.from.id;
    const user = db.getUser(userId);
    const service = ctx.scene.service;

    if (!link.includes('instagram.com') && !link.includes('tiktok.com') && 
        !link.includes('twitter.com') && !link.includes('youtube.com')) {
      return ctx.reply('❌ Invalid link. Please send a valid social media link.');
    }

    // Deduct balance
    user.balance -= service.price;
    const order = {
      id: utils.generateOrderId(),
      userId: userId,
      service: service.name,
      link: link,
      quantity: service.quantity,
      price: service.price,
      status: 'processing',
      createdAt: new Date()
    };
    
    db.updateUser(userId, user);
    db.addOrder(order);

    // Call boost API
    try {
      const response = await axios.get(config.api_url, {
        params: {
          api_key: config.api_key,
          service: service.api_service,
          link: link,
          quantity: service.quantity
        }
      });

      if (response.data.success) {
        order.status = 'completed';
        order.orderId = response.data.order_id;
        db.updateOrder(order.id, order);

        await ctx.reply(
          `✅ *Boost Order Placed!*\n\n` +
          `Order ID: ${order.id}\n` +
          `Service: ${service.name}\n` +
          `Quantity: ${service.quantity}\n` +
          `Price: ₦${service.price}\n` +
          `Status: Processing\n\n` +
          `Your new balance: ₦${user.balance}`,
          Markup.inlineKeyboard([[Markup.button.callback('📊 Back', 'menu')]])
        );
      } else {
        order.status = 'failed';
        db.updateOrder(order.id, order);
        user.balance += service.price;
        db.updateUser(userId, user);

        await ctx.reply(
          `❌ *Boost Failed*\n\n` +
          `${response.data.error}\n\n` +
          `Your balance has been refunded.`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'boost')]])
        );
      }
    } catch (error) {
      order.status = 'failed';
      db.updateOrder(order.id, order);
      user.balance += service.price;
      db.updateUser(userId, user);

      console.error('Boost API error:', error);
      await ctx.reply(
        `❌ *Error processing boost*\n\n` +
        `${error.message}\n\n` +
        `Your balance has been refunded.`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'boost')]])
      );
    }

    delete ctx.scene;
  }
});

// ============ TOPUP COMMANDS ============
bot.command('topup', async (ctx) => {
  await handlers.showTopupMenu(ctx);
});

bot.action(/topup_(.+)/, async (ctx) => {
  const amount = parseInt(ctx.match[1]);
  const user = db.getUser(ctx.from.id);
  
  if (!user) {
    return ctx.reply('❌ User not found. Please use /start first.');
  }

  const accountButtons = config.payment_accounts.map(acc => [
    Markup.button.callback(`${acc.bank} - ${acc.account_name}`, `select_account_${acc.id}`)
  ]);
  accountButtons.push([Markup.button.callback('⬅️ Back', 'topup')]);

  await ctx.reply(
    `💰 *Top-up ₦${amount}*\n\n` +
    `Select a payment account:`,
    Markup.inlineKeyboard(accountButtons)
  );

  ctx.scene = { step: 'topup_amount', amount: amount };
});

bot.action(/select_account_(.+)/, async (ctx) => {
  const accountId = ctx.match[1];
  const account = config.payment_accounts.find(a => a.id === accountId);
  
  if (!account || !ctx.scene || ctx.scene.step !== 'topup_amount') {
    return ctx.answerCbQuery('❌ Error', true);
  }

  await ctx.reply(
    `📤 *Send Payment*\n\n` +
    `Bank: ${account.bank}\n` +
    `Account Name: ${account.account_name}\n` +
    `Account Number: \`${account.account_number}\`\n` +
    `Amount: ₦${ctx.scene.amount}\n\n` +
    `After payment, send a screenshot of the receipt.`,
    { parse_mode: 'Markdown' }
  );

  ctx.scene.step = 'waiting_receipt';
  ctx.scene.accountId = accountId;
  ctx.scene.account = account;
});

bot.on('photo', async (ctx) => {
  if (!ctx.scene || ctx.scene.step !== 'waiting_receipt') {
    return;
  }

  const userId = ctx.from.id;
  const user = db.getUser(userId);
  const topup = {
    id: utils.generateTopupId(),
    userId: userId,
    amount: ctx.scene.amount,
    account: ctx.scene.account,
    status: 'pending',
    screenshot: ctx.message.photo[0].file_id,
    createdAt: new Date()
  };

  db.addTopup(topup);

  await ctx.reply(
    `✅ *Payment Screenshot Received*\n\n` +
    `Topup ID: ${topup.id}\n` +
    `Amount: ₦${ctx.scene.amount}\n` +
    `Status: Pending Admin Approval\n\n` +
    `You will be notified once the payment is verified.`,
    Markup.inlineKeyboard([[Markup.button.callback('📊 Back', 'menu')]])
  );

  // Notify admin
  const adminId = process.env.ADMIN_ID;
  await ctx.telegram.sendMessage(
    adminId,
    `🔔 *New Topup Pending*\n\n` +
    `User ID: ${userId}\n` +
    `Username: @${user.username}\n` +
    `Amount: ₦${ctx.scene.amount}\n` +
    `Topup ID: ${topup.id}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Accept', `approve_topup_${topup.id}`),
        Markup.button.callback('❌ Reject', `reject_topup_${topup.id}`)
      ]
    ])
  );

  delete ctx.scene;
});

// ============ REFERRAL COMMANDS ============
bot.command('referral', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await handlers.showReferralMenu(ctx, user);
});

bot.action('ref_link', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  const refLink = `https://t.me/${(await ctx.telegram.getMe()).username}?start=ref_${user.id}`;
  
  await ctx.reply(
    `🔗 *Your Referral Link*\n\n` +
    `\`${refLink}\`\n\n` +
    `Each referral: 10% commission\n` +
    `Get 20 referrals with ₦1000 each = Free 1K boost!`,
    { parse_mode: 'Markdown' }
  );
});

// Handle referral start
bot.command('start', async (ctx) => {
  const args = ctx.startPayload;
  if (args && args.startsWith('ref_')) {
    const referrerId = parseInt(args.substring(4));
    const referrer = db.getUser(referrerId);
    
    if (referrer) {
      const newUser = db.createUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
      newUser.referrerId = referrerId;
      db.updateUser(ctx.from.id, newUser);
      referrer.totalReferrals = (referrer.totalReferrals || 0) + 1;
      db.updateUser(referrerId, referrer);
    }
  }
});

// ============ ADMIN COMMANDS ============
bot.command('admin', async (ctx) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (ctx.from.id !== adminId) {
    return ctx.reply('❌ Unauthorized');
  }
  await handlers.showAdminMenu(ctx);
});

bot.action('admin_users', async (ctx) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (ctx.from.id !== adminId) {
    return ctx.answerCbQuery('❌ Unauthorized', true);
  }

  const users = db.getAllUsers();
  const userCount = users.length;
  const orders = db.getAllOrders();
  const orderCount = orders.length;

  await ctx.reply(
    `👥 *Admin Statistics*\n\n` +
    `Users: ${userCount}\n` +
    `Orders: ${orderCount}\n` +
    `Total Revenue: ₦${orders.reduce((sum, o) => sum + o.price, 0)}`,
    Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'admin')]])
  );
});

bot.action(/approve_topup_(.+)/, async (ctx) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (ctx.from.id !== adminId) {
    return ctx.answerCbQuery('❌ Unauthorized', true);
  }

  const topupId = ctx.match[1];
  const topup = db.getTopup(topupId);

  if (!topup) {
    return ctx.answerCbQuery('❌ Topup not found', true);
  }

  const user = db.getUser(topup.userId);
  user.balance += topup.amount;
  
  // Commission to referrer
  if (user.referrerId) {
    const referrer = db.getUser(user.referrerId);
    const commission = Math.floor(topup.amount * 0.1);
    referrer.balance += commission;
    db.updateUser(user.referrerId, referrer);
  }

  topup.status = 'approved';
  db.updateTopup(topupId, topup);
  db.updateUser(topup.userId, user);

  await ctx.telegram.sendMessage(
    topup.userId,
    `✅ *Payment Approved!*\n\n` +
    `Amount: ₦${topup.amount}\n` +
    `Your new balance: ₦${user.balance}`,
    Markup.inlineKeyboard([[Markup.button.callback('📊 Menu', 'menu')]])
  );

  await ctx.answerCbQuery('✅ Approved');
  await ctx.editMessageText('✅ Topup approved');
});

bot.action(/reject_topup_(.+)/, async (ctx) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (ctx.from.id !== adminId) {
    return ctx.answerCbQuery('❌ Unauthorized', true);
  }

  const topupId = ctx.match[1];
  const topup = db.getTopup(topupId);

  if (!topup) {
    return ctx.answerCbQuery('❌ Topup not found', true);
  }

  topup.status = 'rejected';
  db.updateTopup(topupId, topup);

  await ctx.telegram.sendMessage(
    topup.userId,
    `❌ *Payment Rejected*\n\n` +
    `Your payment of ₦${topup.amount} was rejected.\n\n` +
    `Please contact @d3nki_dev for more information.`
  );

  await ctx.answerCbQuery('❌ Rejected');
  await ctx.editMessageText('❌ Topup rejected');
});

// ============ HELP COMMANDS ============
bot.command('help', async (ctx) => {
  await handlers.showHelp(ctx);
});

// ============ ERROR HANDLING ============
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
});

// ============ BOT START ============
bot.launch();

console.log('🤖 Bot started successfully!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
