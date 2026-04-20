/**
 * Simple rate limiter that queues requests.
 * Ensures we don't exceed API rate limits.
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

class RateLimiter {
  private queue: QueueItem[] = [];
  private activeRequests: number = 0;
  private maxConcurrent: number;
  private minDelayMs: number;
  private lastRequestTime: number = 0;
  private processing: boolean = false;

  constructor(maxConcurrent: number, minDelayMs: number) {
    this.maxConcurrent = maxConcurrent;
    this.minDelayMs = minDelayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      // Enforce minimum delay between requests
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minDelayMs) {
        await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
      }

      this.activeRequests++;
      this.lastRequestTime = Date.now();

      item
        .fn()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
    }

    this.processing = false;
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeRequests;
  }
}

// Yahoo Finance: no hard rate limit, but be polite
// ~2 concurrent, 200ms between requests
export const yahooLimiter = new RateLimiter(2, 200);

// Twelve Data: 8 requests/minute = 1 every 7.5 seconds
// Use 1 concurrent, 8 seconds between requests to be safe
export const twelveDataLimiter = new RateLimiter(1, 8000);