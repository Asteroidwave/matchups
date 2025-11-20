/**
 * Retry utility with exponential backoff
 */

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        console.error(`❌ All ${maxAttempts} attempts failed`);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      
      console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`, lastError.message);
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Fetch with automatic retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, retryOptions);
}

