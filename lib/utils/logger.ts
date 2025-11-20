/**
 * Production-ready logging utility
 * Reduces console spam in production while keeping essential error logging
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(message, data || '');
    }
  },
  
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.info(message, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(message, data || '');
  },
  
  error: (message: string, data?: any) => {
    console.error(message, data || '');
  },
  
  // Always log in production for critical events
  production: (message: string, data?: any) => {
    console.log(message, data || '');
  }
};

export default logger;