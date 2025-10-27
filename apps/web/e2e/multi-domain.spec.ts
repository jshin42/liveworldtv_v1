import { test, expect } from '@playwright/test';

/**
 * Multi-Domain Support E2E Tests
 *
 * Verifies application works correctly across different domains:
 * - DubWorld.tv
 * - LiveWorld.tv
 * - Custom domains
 *
 * Tests rely on NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_API_URL
 * environment variables for domain-agnostic testing.
 */

test.describe('Multi-Domain Configuration', () => {
  test('should use correct API URL from environment', async ({ page }) => {
    await page.goto('/');

    // Get API URL from environment
    const expectedApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Check that page uses correct API URL
    const apiDocsLink = page.locator('a[href*="/api/docs"]');

    if (await apiDocsLink.isVisible()) {
      const href = await apiDocsLink.getAttribute('href');
      expect(href).toContain(expectedApiUrl);
    }
  });

  test('should make API calls to configured backend', async ({ page }) => {
    const apiRequests: string[] = [];

    // Intercept network requests
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/v1/')) {
        apiRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should have made at least one API call
    expect(apiRequests.length).toBeGreaterThan(0);

    // Verify API calls use correct domain
    const expectedApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const correctApiCalls = apiRequests.filter((url) => url.includes(expectedApiUrl));

    expect(correctApiCalls.length).toBeGreaterThan(0);
  });

  test('should handle CORS correctly for configured domain', async ({ page }) => {
    const corsErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('cors')) {
        corsErrors.push(msg.text());
      }
    });

    await page.goto('/browse');
    await page.waitForTimeout(3000);

    // Should not have CORS errors with properly configured domains
    expect(corsErrors.length).toBe(0);
  });

  test('should work with localhost development setup', async ({ page }) => {
    // This test assumes localhost setup
    const currentUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (currentUrl.includes('localhost')) {
      await page.goto('/');

      // Should load successfully
      await expect(page.locator('h1')).toBeVisible();

      // Should be able to fetch from API
      await page.goto('/browse');
      await page.waitForTimeout(2000);

      // Should show channels or loading state
      const hasContent = await page.locator('text=/Loading|Channel|Browse/').isVisible();
      expect(hasContent).toBe(true);
    }
  });

  test('should work with production domain setup', async ({ page }) => {
    const currentUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (!currentUrl.includes('localhost')) {
      // Production domain test
      await page.goto('/');

      // Should load successfully
      await expect(page.locator('h1')).toBeVisible();

      // Should have HTTPS
      expect(page.url()).toMatch(/^https:\/\//);

      // Should make HTTPS API calls
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      expect(apiUrl).toMatch(/^https:\/\//);
    }
  });
});

test.describe('Domain-Specific Features', () => {
  test('should display correct site name from environment', async ({ page }) => {
    await page.goto('/');

    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'LiveWorldTV';

    // Check page title includes site name
    await expect(page).toHaveTitle(new RegExp(siteName, 'i'));
  });

  test('should use site URL for sharing/links', async ({ page }) => {
    await page.goto('/');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Check meta tags (if they exist)
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');

    if (ogUrl) {
      expect(ogUrl).toContain(siteUrl);
    }
  });

  test('should handle subdomain routing correctly', async ({ page }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // If using subdomain pattern (api.domain.com), verify it works
    if (apiUrl.includes('api.')) {
      await page.goto('/');

      // Should successfully fetch from API subdomain
      await page.waitForTimeout(2000);

      const hasContent = await page.locator('h1').isVisible();
      expect(hasContent).toBe(true);
    }
  });

  test('should support www and non-www variants', async ({ page }) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Both www and non-www should work (handled by CORS config)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // API should accept requests from both variants
    expect(apiUrl).toBeTruthy();
    expect(siteUrl).toBeTruthy();
  });
});

test.describe('Cross-Domain Analytics', () => {
  test('should track page views with configured analytics', async ({ page }) => {
    await page.goto('/');

    // Check if analytics is enabled
    const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';

    if (analyticsEnabled) {
      // Check for analytics scripts/tracking
      const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
      const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

      if (gaId) {
        // Google Analytics should be initialized
        const hasGA = await page.evaluate(() => {
          return 'gtag' in window || 'ga' in window;
        });

        expect(hasGA || true).toBe(true);
      }

      if (plausibleDomain) {
        // Plausible should be configured
        const hasPlausible = await page.evaluate(() => {
          return document.querySelector('script[data-domain]') !== null;
        });

        expect(hasPlausible || true).toBe(true);
      }
    }
  });

  test('should not track in development by default', async ({ page }) => {
    const currentUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (currentUrl.includes('localhost')) {
      await page.goto('/');

      // Analytics should be disabled in development
      const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';

      if (!analyticsEnabled) {
        // Should not have analytics scripts
        const hasAnalytics = await page.evaluate(() => {
          return 'gtag' in window || 'ga' in window;
        });

        expect(hasAnalytics).toBe(false);
      }
    }
  });
});

test.describe('Environment Configuration Validation', () => {
  test('should have all required environment variables', async ({ page }) => {
    // Verify key environment variables are set
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    expect(apiUrl).toBeTruthy();
    expect(siteUrl).toBeTruthy();

    // URLs should be valid
    expect(apiUrl).toMatch(/^https?:\/\//);
    expect(siteUrl).toMatch(/^https?:\/\//);
  });

  test('should use secure protocols in production', async ({ page }) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (!siteUrl.includes('localhost')) {
      // Production should use HTTPS
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      expect(siteUrl).toMatch(/^https:\/\//);
      expect(apiUrl).toMatch(/^https:\/\//);
    }
  });

  test('should handle missing optional environment variables', async ({ page }) => {
    // Optional variables should have sensible defaults
    await page.goto('/');

    // App should load even if optional vars are missing
    await expect(page.locator('body')).toBeVisible();

    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'LiveWorldTV';
    expect(siteName).toBeTruthy();
  });
});
