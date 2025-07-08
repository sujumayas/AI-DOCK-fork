/**
 * JSX Helper Utilities
 * Prevents common TypeScript errors in React JSX
 */

/**
 * Safe console log for JSX debugging
 * Use this instead of console.log directly in JSX to avoid void return type errors
 * 
 * @example
 * // ❌ Don't do this in JSX:
 * {console.log('debug', value)}
 * 
 * // ✅ Do this instead:
 * {debugLog('debug', value)}
 */
export const debugLog = (...args: any[]): null => {
  console.log(...args);
  return null; // Explicitly return null (valid ReactNode)
};

/**
 * Safe conditional rendering helper
 * Ensures boolean expressions don't accidentally render as text
 * 
 * @example
 * // ❌ Might render "false" as text:
 * {condition && <Component />}
 * 
 * // ✅ Always safe:
 * {safeRender(condition, <Component />)}
 */
export const safeRender = (condition: boolean, element: React.ReactNode): React.ReactNode => {
  return condition ? element : null;
};

/**
 * Safe function call in JSX
 * Wraps function calls to ensure they return valid ReactNode
 */
export const safeFunctionCall = (fn: () => void): null => {
  fn();
  return null;
};