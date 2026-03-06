const utils = {
  generateOrderId: () => {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  },

  generateTopupId: () => {
    return 'TUP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  },

  generateRedeemCode: (amount) => {
    return 'CODE-' + amount + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  },

  formatCurrency: (amount) => {
    return `₦${amount.toLocaleString()}`;
  },

  validateLink: (link) => {
    const validPlatforms = ['instagram.com', 'tiktok.com', 'twitter.com', 'youtube.com'];
    return validPlatforms.some(platform => link.includes(platform));
  }
};

module.exports = utils;
