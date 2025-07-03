// 💰 Format Utilities
// Common formatting functions used across the application
// Ensures consistent display of currency, numbers, and other values

/**
 * Format currency values consistently across the application
 * 
 * This function handles the full range of AI usage costs:
 * - Large amounts ($1000+): Shows abbreviated format like "$2.5k"
 * - Regular amounts ($1-999): Shows standard dollars like "$15.75"
 * - Small amounts (1¢-99¢): Shows cents only like "15.2¢"
 * - Micro amounts (<1¢): Shows precise dollars like "$0.0034"
 * 
 * FIXED: No more confusing "$xx.x¢" format that mixed symbols
 * 
 * @param amount - The amount in USD
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === 0) return 'Free';
  
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  } else if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  } else if (amount >= 0.01) {
    // Show just cents for small amounts (clear it's currency)
    return `${(amount * 100).toFixed(1)}¢`;
  } else {
    // For very small amounts, show as dollars with more precision
    return `$${amount.toFixed(4)}`;
  }
};

/**
 * Format large numbers with proper abbreviations
 * 
 * @param num - The number to format
 * @returns Formatted number string with K/M abbreviations
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  } else {
    return num.toLocaleString();
  }
};

/**
 * Format response time for display
 * 
 * @param ms - Response time in milliseconds
 * @returns Formatted time string
 */
export const formatResponseTime = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${Math.round(ms)}ms`;
  }
};

/**
 * Format percentage values consistently
 * 
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format token counts with proper abbreviations
 * 
 * @param tokens - Number of tokens
 * @returns Formatted token string
 */
export const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M tokens`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  } else {
    return `${tokens.toLocaleString()} tokens`;
  }
};

/**
 * Example usage across the app:
 * 
 * // Usage Analytics
 * {formatCurrency(0.0096)}     → "$0.0096"
 * {formatCurrency(0.15)}       → "15.0¢"  
 * {formatCurrency(2.50)}       → "$2.50"
 * {formatCurrency(1500)}       → "$1.5k"
 * 
 * // Numbers and metrics
 * {formatNumber(1234)}         → "1.2K"
 * {formatTokens(15000)}        → "15.0K tokens"
 * {formatPercentage(95.7)}     → "95.7%"
 * {formatResponseTime(1250)}   → "1.3s"
 */
