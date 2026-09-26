// ==============================================================================
// ROADRISK AI — SERVER TTL & ETAG CACHE
// ==============================================================================

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
    };

    // Periodic sweep every 60s
    this.interval = setInterval(() => this.sweep(), 60000);
    if (this.interval.unref) this.interval.unref();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  getWithMeta(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key, value, ttlMs = 60000, etag = null) {
    this.cache.set(key, {
      value,
      etag,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    this.stats.sets++;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      ...this.stats,
    };
  }
}

const cacheManager = new CacheManager();
module.exports = { cacheManager, CacheManager };
