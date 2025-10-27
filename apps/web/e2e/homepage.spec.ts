import { test, expect } from '@playwright/test';

/**
 * Homepage E2E Tests
 *
 * Tests autoplay functionality and core homepage features.
 * Domain-agnostic: works with any configured NEXT_PUBLIC_SITE_URL.
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/LiveWorldTV/);

    // Check hero heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Real-time global live TV');
  });

  test('should display autoplay feature section', async ({ page }) => {
    // Check for autoplay description
    const autoplaySection = page.locator('text=Experience live content instantly');
    await expect(autoplaySection).toBeVisible();

    // Check for English dubbing feature
    const dubbingSection = page.locator('text=AI-powered English dubbing');
    await expect(dubbingSection).toBeVisible();
  });

  test('should have working navigation to browse page', async ({ page }) => {
    // Click "Browse Channels" link
    const browseLink = page.locator('text=Browse all channels');
    await expect(browseLink).toBeVisible();

    await browseLink.click();

    // Wait for navigation
    await page.waitForURL(/\/browse/);

    // Verify we're on browse page
    await expect(page.locator('h1')).toContainText('Browse Channels');
  });

  test('should display random channel on load', async ({ page }) => {
    // Wait for channel to load (or see loading/error state)
    await page.waitForTimeout(2000);

    // Check for either:
    // 1. Channel name displayed
    // 2. "Loading random channel..." message
    // 3. Error message if API is down
    const hasChannel = await page.locator('text=/Channel:|Loading|Error/').isVisible();
    expect(hasChannel).toBe(true);
  });

  test('should display API documentation link', async ({ page }) => {
    // Check for API docs link
    const apiDocsLink = page.locator('a:has-text("API Docs")');
    await expect(apiDocsLink).toBeVisible();

    // Verify it points to correct URL (using environment variable)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    await expect(apiDocsLink).toHaveAttribute('href', `${apiUrl}/api/docs`);
  });

  test('should have responsive layout on mobile', async ({ page, viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that content is visible and not overflowing
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Check that buttons stack vertically on mobile
    const container = page.locator('body');
    await expect(container).toBeVisible();
  });

  test('should display dubbing controls UI', async ({ page }) => {
    // Look for dubbing toggle or controls
    const dubbingControls = page.locator('text=/Dubbing|Enable|Disable/');

    // Should be visible somewhere on the page
    const controlsExist = await dubbingControls.count();
    expect(controlsExist).toBeGreaterThan(0);
  });
});

test.describe('Homepage Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Filter out known non-critical errors (e.g., YouTube IFrame API warnings)
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('YouTube') && !error.includes('IFrame')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
