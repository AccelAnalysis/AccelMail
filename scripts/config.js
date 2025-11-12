// scripts/config.js
export const CONFIG = {
  // This URL should be replaced with your actual Google Apps Script deployment URL
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  
  // Fallback configuration in case the remote config fails
  FALLBACK_CONFIG: {
    mailerSizes: [
      { name: 'Postcard (4.25" x 6")' },
      { name: 'Letter (8.5" x 11")' },
      { name: 'Flyer (8.5" x 11" tri-fold)' }
    ],
    designFee: 99,
    blackoutDates: []
  },
  
  // UI Configuration
  PRIMARY_COLOR: '#2F5597',
  ACCENT_COLOR: '#FFD965',
  COMPANY_EMAIL: 'accelmail@accelanalysis.com',
  
  // Pricing configuration (simplified for demo)
  PRICING: {
    'Postcard (4.25" x 6")': {
      '50-99': 0.75,
      '100-249': 0.65,
      '250-499': 0.55,
      '500-749': 0.50,
      '750-999': 0.45,
      '1000-1999': 0.40,
      '2000+': 0.35
    },
    'Letter (8.5" x 11")': {
      '50-99': 1.25,
      '100-249': 1.10,
      '250-499': 0.95,
      '500-749': 0.85,
      '750-999': 0.75,
      '1000-1999': 0.65,
      '2000+': 0.55
    },
    'Flyer (8.5" x 11" tri-fold)': {
      '50-99': 1.50,
      '100-249': 1.35,
      '250-499': 1.20,
      '500-749': 1.10,
      '750-999': 1.00,
      '1000-1999': 0.90,
      '2000+': 0.80
    }
  }
};