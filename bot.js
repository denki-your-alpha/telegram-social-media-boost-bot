const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const config = require('./config.json');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const FOOTER = '\n\n_Developer by 𝕄Ｅ𝓃ⓐ_';

// Admin IDs
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

// ==================== REDEEM COMMAND ====================
bot.onText(/\/redeem (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const code = match[1].toUpperCase();
  
  try {
    const redeemCode = await db.getRedeemCode(code);
    
    if (!redeemCode) {
      return bot.sendMessage(chatId, '❌ Invalid redeem code!' + FOOTER);
    }
    
    if (redeemCode.redeemed_count >= redeemCode.max_uses) {
      return bot.sendMessage(chatId, '❌ This code has reached its redemption limit!' + FOOTER);
    }
    
    // Check if user already redeemed this code
    const alreadyRedeemed = await db.checkUserRedeemCode(chatId, code);
    if (alreadyRedeemed) {
      return bot.sendMessage(chatId, '❌ You have already redeemed this code!' + FOOTER);
    }
    
    // Add balance to user
    await db.addUserBalance(chatId, redeemCode.amount);
    await db.recordRedeemCode(chatId, code);
    
    const message = `✅ *Redeem Successful!*\n\nYou have received: *${redeemCode.amount}* balance\nCurrent Balance: *${await db.getUserBalance(chatId)}*` + FOOTER;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Redeem error:', error);
    bot.sendMessage(chatId, '❌ An error occurred while processing your redeem code!' + FOOTER);
  }
});

// ==================== EDIT PRICE COMMAND ====================
bot.onText(/\/edit (.+) (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const platform = match[1].toLowerCase();
  const type = match[2].toLowerCase();
  const newPrice = parseFloat(match[3]);
  
  if (isNaN(newPrice)) {
    return bot.sendMessage(chatId, '❌ Invalid price format!' + FOOTER);
  }
  
  try {
    await db.updateBoostPrice(platform, type, newPrice);
    bot.sendMessage(chatId, `✅ Price updated!\n*${platform}* - *${type}*: *${newPrice}*` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Edit price error:', error);
    bot.sendMessage(chatId, '❌ Error updating price!' + FOOTER);
  }
});

// ==================== DETAILS COMMAND ====================
bot.onText(/\/Details (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const bankName = match[1];
  const accountNumber = match[2];
  
  try {
    await db.updateBankDetails(chatId, bankName, accountNumber);
    bot.sendMessage(chatId, `✅ Bank details updated!\n*Bank:* ${bankName}\n*Account:* ${accountNumber}` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Details error:', error);
    bot.sendMessage(chatId, '❌ Error updating bank details!' + FOOTER);
  }
});

// ==================== ADD CHANNEL COMMAND ====================
bot.onText(/\/Addch (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const channelUsername = match[1];
  
  try {
    await db.addChannel(channelUsername);
    bot.sendMessage(chatId, `✅ Channel added: *${channelUsername}*\nUsers must follow this channel after starting the bot.` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Add channel error:', error);
    bot.sendMessage(chatId, '❌ Error adding channel!' + FOOTER);
  }
});

// ==================== ADD ADMIN COMMAND ====================
bot.onText(/\/Addadmin (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const superAdminId = process.env.SUPER_ADMIN_ID;
  
  if (chatId.toString() !== superAdminId) {
    return bot.sendMessage(chatId, '❌ Only the main admin can add temporary admins!' + FOOTER);
  }
  
  const newAdminId = match[1];
  
  try {
    await db.addTempAdmin(newAdminId);
    bot.sendMessage(chatId, `✅ Temporary admin added: *${newAdminId}*` + FOOTER, { parse_mode: 'Markdown' });
    bot.sendMessage(newAdminId, '✅ You have been added as a temporary admin!' + FOOTER);
  } catch (error) {
    console.error('Add admin error:', error);
    bot.sendMessage(chatId, '❌ Error adding admin!' + FOOTER);
  }
});

// ==================== DELETE ADMIN COMMAND ====================
bot.onText(/\/Deladmin (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const superAdminId = process.env.SUPER_ADMIN_ID;
  
  if (chatId.toString() !== superAdminId) {
    return bot.sendMessage(chatId, '❌ Only the main admin can delete admins!' + FOOTER);
  }
  
  const adminIdToDelete = match[1];
  
  try {
    const wasAdded = await db.isTempAdmin(adminIdToDelete);
    if (!wasAdded) {
      return bot.sendMessage(chatId, '❌ This admin was not added by you or does not exist!' + FOOTER);
    }
    
    await db.deleteTempAdmin(adminIdToDelete);
    bot.sendMessage(chatId, `✅ Admin deleted: *${adminIdToDelete}*` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Delete admin error:', error);
    bot.sendMessage(chatId, '❌ Error deleting admin!' + FOOTER);
  }
});

// ==================== ADD TUTORIAL COMMAND ====================
bot.onText(/\/Addtutorial (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const tutorialLink = match[1];
  
  try {
    await db.addTutorial(tutorialLink);
    bot.sendMessage(chatId, `✅ Tutorial link added: [View Tutorial](${tutorialLink})` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Add tutorial error:', error);
    bot.sendMessage(chatId, '❌ Error adding tutorial!' + FOOTER);
  }
});

// ==================== DELETE TUTORIAL COMMAND ====================
bot.onText(/\/Deltutorial (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const tutorialId = match[1];
  
  try {
    await db.deleteTutorial(tutorialId);
    bot.sendMessage(chatId, `✅ Tutorial deleted!` + FOOTER);
  } catch (error) {
    console.error('Delete tutorial error:', error);
    bot.sendMessage(chatId, '❌ Error deleting tutorial!' + FOOTER);
  }
});

// ==================== RESET API COMMAND ====================
bot.onText(/\/resetapi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const superAdminId = process.env.SUPER_ADMIN_ID;
  
  if (chatId.toString() !== superAdminId) {
    return bot.sendMessage(chatId, '❌ Only the main admin can reset the API!' + FOOTER);
  }
  
  const newApiKey = match[1];
  
  try {
    await db.updateApiKey(newApiKey);
    bot.sendMessage(chatId, `✅ API key updated successfully!` + FOOTER);
  } catch (error) {
    console.error('Reset API error:', error);
    bot.sendMessage(chatId, '❌ Error resetting API key!' + FOOTER);
  }
});

// ==================== BROADCAST COMMAND ====================
bot.onText(/\/Broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const message = match[1];
  
  try {
    const users = await db.getAllUsers();
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await bot.sendMessage(user.chat_id, message + FOOTER);
        sent++;
      } catch (error) {
        failed++;
      }
    }
    
    bot.sendMessage(chatId, `✅ Broadcast completed!\n*Sent:* ${sent}\n*Failed:* ${failed}` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Broadcast error:', error);
    bot.sendMessage(chatId, '❌ Error sending broadcast!' + FOOTER);
  }
});

// ==================== GENERATE CODE COMMAND ====================
bot.onText(/\/Gencode (.+) (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const code = match[1].toUpperCase();
  const amount = parseFloat(match[2]);
  const maxUses = parseInt(match[3]);
  
  if (isNaN(amount) || isNaN(maxUses)) {
    return bot.sendMessage(chatId, '❌ Invalid amount or max uses!' + FOOTER);
  }
  
  try {
    await db.createRedeemCode(code, amount, maxUses);
    bot.sendMessage(chatId, `✅ Redeem code generated!\n*Code:* \`${code}\`\n*Amount:* ${amount}\n*Max Uses:* ${maxUses}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Generate code error:', error);
    bot.sendMessage(chatId, '❌ Error generating code!' + FOOTER);
  }
});

// ==================== BAN COMMAND ====================
bot.onText(/\/Ban (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const userIdentifier = match[1];
  
  try {
    await db.banUser(userIdentifier);
    bot.sendMessage(chatId, `✅ User banned: *${userIdentifier}*` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ban error:', error);
    bot.sendMessage(chatId, '❌ Error banning user!' + FOOTER);
  }
});

// ==================== UNBAN COMMAND ====================
bot.onText(/\/Unban (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!ADMIN_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, '❌ You do not have permission to use this command!' + FOOTER);
  }
  
  const userIdentifier = match[1];
  
  try {
    await db.unbanUser(userIdentifier);
    bot.sendMessage(chatId, `✅ User unbanned: *${userIdentifier}*` + FOOTER, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Unban error:', error);
    bot.sendMessage(chatId, '❌ Error unbanning user!' + FOOTER);
  }
});

// ==================== DATA PURCHASE COMMAND ====================
bot.onText(/\/purchase/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Fetch available networks from API
    const apiKey = await db.getApiKey();
    const apiResponse = await axios.get(`${config.API_BASE_URL}/networks`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const networks = apiResponse.data.networks;
    const buttons = networks.map(network => [{
      text: network.name,
      callback_data: `data_select_network_${network.id}`
    }]);
    
    bot.sendMessage(chatId, '📱 Select Network:' + FOOTER, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    console.error('Data purchase error:', error);
    bot.sendMessage(chatId, '❌ Error fetching available networks!' + FOOTER);
  }
});

// ==================== CALLBACK HANDLERS ====================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  try {
    if (data.startsWith('data_select_network_')) {
      const networkId = data.split('_')[3];
      const apiKey = await db.getApiKey();
      
      // Fetch data plans for selected network
      const plans = await axios.get(`${config.API_BASE_URL}/plans/${networkId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      const buttons = plans.data.plans.map(plan => [{
        text: `${plan.amount} - ${plan.size}`,
        callback_data: `data_select_plan_${plan.id}`
      }]);
      
      bot.editMessageText('📋 Select Data Plan:' + FOOTER, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: { inline_keyboard: buttons }
      });
    }
    
    if (data.startsWith('data_select_plan_')) {
      const planId = data.split('_')[3];
      
      // Store plan selection and ask for phone number
      await db.setUserState(chatId, 'awaiting_phone_number', planId);
      
      bot.sendMessage(chatId, '📞 Please enter your phone number:' + FOOTER);
      bot.editMessageReplyMarkup({}, { chat_id: chatId, message_id: query.message.message_id });
    }
  } catch (error) {
    console.error('Callback error:', error);
    bot.answerCallbackQuery(query.id, { text: '❌ Error processing request!' });
  }
});

// ==================== PHONE NUMBER HANDLER ====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userState = await db.getUserState(chatId);
  
  if (userState && userState.state === 'awaiting_phone_number') {
    const phoneNumber = msg.text;
    const planId = userState.data;
    
    // Validate phone number (basic validation)
    if (!/^\d{10,15}$/.test(phoneNumber)) {
      return bot.sendMessage(chatId, '❌ Invalid phone number! Please enter a valid number.' + FOOTER);
    }
    
    try {
      // Get plan details
      const plan = await db.getPlanDetails(planId);
      
      const confirmButtons = [[
        { text: '✅ Confirm', callback_data: `confirm_purchase_${planId}_${phoneNumber}` },
        { text: '❌ Cancel', callback_data: 'cancel_purchase' }
      ]];
      
      bot.sendMessage(chatId, 
        `🔍 *Confirm Purchase*\n\nAmount: *${plan.amount}*\nData: *${plan.size}*\nPhone: *${phoneNumber}*\n\nDo you want to proceed?` + FOOTER,
        { 
          reply_markup: { inline_keyboard: confirmButtons },
          parse_mode: 'Markdown'
        }
      );
      
      await db.setUserState(chatId, 'awaiting_confirmation', { planId, phoneNumber });
    } catch (error) {
      console.error('Plan fetch error:', error);
      bot.sendMessage(chatId, '❌ Error fetching plan details!' + FOOTER);
    }
  }
});

// ==================== CONFIRM PURCHASE ====================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  if (data.startsWith('confirm_purchase_')) {
    const [_, planId, phoneNumber] = data.split('_');
    
    try {
      const apiKey = await db.getApiKey();
      const plan = await db.getPlanDetails(planId);
      
      // Process purchase via API
      const purchaseResponse = await axios.post(`${config.API_BASE_URL}/purchase`, {
        plan_id: planId,
        phone_number: phoneNumber
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (purchaseResponse.data.success) {
        // Deduct balance from user
        const userBalance = await db.getUserBalance(chatId);
        await db.updateUserBalance(chatId, userBalance - plan.amount);
        
        bot.editMessageText(
          `✅ *Purchase Successful!*\n\nData: *${plan.size}*\nPhone: *${phoneNumber}*\nAmount Paid: *${plan.amount}*\n\nYour data will be credited shortly.` + FOOTER,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] }
          }
        );
        
        // Record transaction
        await db.recordTransaction(chatId, 'data_purchase', plan.amount, phoneNumber);
      } else {
        bot.sendMessage(chatId, '❌ Purchase failed! Please try again.' + FOOTER);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      bot.sendMessage(chatId, '❌ Error processing purchase!' + FOOTER);
    }
  }
  
  if (data === 'cancel_purchase') {
    bot.editMessageText('❌ Purchase cancelled.' + FOOTER, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
    await db.setUserState(chatId, null);
  }
});

console.log('✅ Bot started successfully!');
