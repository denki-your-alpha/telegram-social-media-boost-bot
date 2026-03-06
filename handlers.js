const { Markup } = require('telegraf');

const handlers = {
  // Main menu
  showMainMenu: async (ctx, user) => {
    const banner =
      `╔━━━━🌹 ⃟𝗪𝗲𝗹𝗹𝗰𝗼𝗺é🌹 ⃟ ━━━━╗\n` +
      `     ⃫⃟⃤ ${user.username} ⃫⃟⃤\n` +
      `◚━━━━━━━⌬⌬⌬⌬━━━━━━━◚\n` +
      `╔⎔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔⎔╗\n` +
      `◈ Name : ${user.name}\n` +
      `◈ Joined : ${user.joinedAt.substring(0, 10)}\n` +
      `◈ User ID : ${user.id}\n` +
      `◈ Balance : ₦${user.balance}\n` +
      `◈ Referrals : ${user.totalReferrals || 0}\n` +
      `◈ Orders : ${user.totalOrders || 0}\n` +
      `╚⎔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁⎔╝\n` +
      `╔⎔━━━🌹 ⃟DETAILS🌹 ⃟━━━⎔╗\n` +
      `✧ /boost /topup /referral\n` +
      `✧ /help /tutorial\n` +
      `✧ Dev @d3nki_dev\n` +
      `╚⎔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁⎔╝`;

    const buttons = [
      [Markup.button.callback('🚀 Boost', 'boost'), Markup.button.callback('💰 Top-up', 'topup')],
      [Markup.button.callback('👥 Referral', 'referral')],
      [Markup.button.callback('ℹ️ Help', 'help'), Markup.button.callback('📚 Tutorial', 'tutorial')]
    ];

    // Add admin button if user is admin
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      buttons.push([Markup.button.callback('⚙️ Admin', 'admin')]);
    }

    await ctx.reply(banner, Markup.inlineKeyboard(buttons));
  },

  // Boost menu
  showBoostMenu: async (ctx) => {
    const config = ctx.state.config;
    const db = ctx.state.db;
    const user = db.getUser(ctx.from.id);

    let message = `🚀 *Available Boost Services*\n\n`;
    message += `Your Balance: ₦${user.balance}\n\n`;

    const buttons = config.prices.map(service => [
      Markup.button.callback(
        `${service.name} - ₦${service.price}`,
        `boost_service_${service.id}`
      )
    ]);
    buttons.push([Markup.button.callback('⬅️ Back', 'menu')]);

    await ctx.reply(message, Markup.inlineKeyboard(buttons), { parse_mode: 'Markdown' });
  },

  // Topup menu
  showTopupMenu: async (ctx) => {
    const config = ctx.state.config;
    const topupAmounts = [5000, 10000, 20000, 50000, 100000];

    const buttons = topupAmounts.map(amount => [
      Markup.button.callback(`₦${amount}`, `topup_${amount}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Back', 'menu')]);

    await ctx.reply(
      `💰 *Top-up Your Account*\n\n` +
      `Select an amount:`,
      Markup.inlineKeyboard(buttons),
      { parse_mode: 'Markdown' }
    );
  },

  // Referral menu
  showReferralMenu: async (ctx, user) => {
    const message =
      `👥 *Referral Program*\n\n` +
      `Your Referrals: ${user.totalReferrals || 0}\n` +
      `Commission: 10% of each referral's topup\n\n` +
      `Special Bonus:\n` +
      `Get 20 referrals with ₦1000 each = Free 1K boost!`;

    await ctx.reply(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔗 Get Referral Link', 'ref_link')],
        [Markup.button.callback('⬅️ Back', 'menu')]
      ]),
      { parse_mode: 'Markdown' }
    );
  },

  // Admin menu
  showAdminMenu: async (ctx) => {
    const db = ctx.state.db;
    const users = db.getAllUsers();
    const orders = db.getAllOrders();

    const banner =
      `╔━━━━🌹 ⃟ADMIN🌹 ⃟━━━━╗\n` +
      `◈ Users : ${users.length}\n` +
      `◈ Orders: ${orders.length}\n` +
      `╚⎔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁⎔╝`;

    await ctx.reply(
      banner,
      Markup.inlineKeyboard([
        [Markup.button.callback('👥 Users', 'admin_users')],
        [Markup.button.callback('⬅️ Back', 'menu')]
      ])
    );
  },

  // Help menu
  showHelp: async (ctx) => {
    const help =
      `❓ *How to Use This Bot*\n\n` +
      `Step 1️⃣: Join all required channels\n` +
      `Step 2️⃣: Use /boost to boost your social media\n` +
      `Step 3️⃣: Use /topup to add money to your account\n` +
      `Step 4️⃣: Use /referral to earn commissions\n` +
      `Step 5️⃣: Stay tuned fot daily Redeem codes on our channel\n\n` +
      `❗ Need help? Contact @d3nki_dev`;

    await ctx.reply(
      help,
      Markup.inlineKeyboard([
        [Markup.button.callback('📚 Tutorial', 'tutorial')],
        [Markup.button.callback('⬅️ Back', 'menu')]
      ]),
      { parse_mode: 'Markdown' }
    );
  }
};

module.exports = handlers;
