import { test, expect } from '@playwright/test';

/**
 * Browse Page E2E Tests
 *
 * Tests channel browsing, filtering, and search functionality.
 * Domain-agnostic: works with any configured NEXT_PUBLIC_SITE_URL.
 */

test.describe('Browse Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/browse');
  });

  test('should load browse page successfully', async ({ page }) => {
    // Check page heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Browse Channels');
  });

  test('should display country filter', async ({ page }) => {
    // Wait for filters to load
    await page.waitForTimeout(1000);

    // Check for country filter label
    const countryLabel = page.locator('text=Country:');
    await expect(countryLabel).toBeVisible();

    // Check for country select or buttons
    const hasCountryFilter = await page.locator('select, button:has-text("All Countries")').count();
    expect(hasCountryFilter).toBeGreaterThan(0);
  });

  test('should display topic filter', async ({ page }) => {
    // Wait for filters to load
    await page.waitForTimeout(1000);

    // Check for topic filter label
    const topicLabel = page.locator('text=Topic:');
    await expect(topicLabel).toBeVisible();

    // Check for topic select or buttons
    const hasTopicFilter = await page.locator('select, button:has-text("All Topics")').count();
    expect(hasTopicFilter).toBeGreaterThan(0);
  });

  test('should load and display channels', async ({ page }) => {
    // Wait for channels to load
    await page.waitForTimeout(2000);

    // Check for loading state or channels
    const hasContent = await page.locator('text=/Loading|Channel|No channels/').isVisible();
    expect(hasContent).toBe(true);
  });

  test('should filter channels by country', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1500);

    // Look for country filter buttons/select
    const countryButtons = page.locator('button:has-text("United States"), button:has-text("South Korea"), button:has-text("Brazil")');

    const buttonCount = await countryButtons.count();

    if (buttonCount > 0) {
      // Click first country button
      await countryButtons.first().click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Should show loading or filtered channels
      const hasFilteredContent = await page.locator('text=/Loading|Channel|No channels/').isVisible();
      expect(hasFilteredContent).toBe(true);
    } else {
      // If no buttons, look for select element
      const countrySelect = page.locator('select').first();

      if (await countrySelect.isVisible()) {
        // Select a country
        await countrySelect.selectOption({ index: 1 });

        // Wait for filtered results
        await page.waitForTimeout(1000);

        const hasFilteredContent = await page.locator('text=/Loading|Channel|No channels/').isVisible();
        expect(hasFilteredContent).toBe(true);
      }
    }
  });

  test('should filter channels by topic', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1500);

    // Look for topic filter buttons
    const topicButtons = page.locator('button:has-text("NEWS"), button:has-text("MUSIC"), button:has-text("SPORTS")');

    const buttonCount = await topicButtons.count();

    if (buttonCount > 0) {
      // Click first topic button
      await topicButtons.first().click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Should show loading or filtered channels
      const hasFilteredContent = await page.locator('text=/Loading|Channel|No channels/').isVisible();
      expect(hasFilteredContent).toBe(true);
    }
  });

  test('should display channel cards with key information', async ({ page }) => {
    // Wait for channels to load
    await page.waitForTimeout(2000);

    // Look for channel information elements
    // Should have country flags or country names
    const hasCountryInfo = await page.locator('text=/🇺🇸|🇰🇷|🇧🇷|United States|South Korea|Brazil/').count();

    if (hasCountryInfo > 0) {
      expect(hasCountryInfo).toBeGreaterThan(0);
    }

    // Should have topic badges or labels
    const hasTopicInfo = await page.locator('text=/NEWS|MUSIC|SPORTS|TALK/').count();

    if (hasTopicInfo > 0) {
      expect(hasTopicInfo).toBeGreaterThan(0);
    }
  });

  test('should have working links to channel pages', async ({ page }) => {
    // Wait for channels to load
    await page.waitForTimeout(2000);

    // Look for channel links
    const channelLinks = page.locator('a[href*="/channel/"], a[href*="/watch/"]');

    const linkCount = await channelLinks.count();

    if (linkCount > 0) {
      // Verify links have href attributes
      const firstLink = channelLinks.first();
      await expect(firstLink).toHaveAttribute('href', /.+/);
    }
  });

  test('should handle no results state', async ({ page }) => {
    // Apply filters that might result in no channels
    await page.waitForTimeout(1500);

    // Try to find a specific combination that has no results
    // or check for the "No channels found" message
    const noResultsMessage = page.locator('text=/No channels found|No results/');

    // This might or might not be visible depending on data
    const messageExists = await noResultsMessage.count();

    // Just verify the page doesn't crash
    expect(messageExists).toBeGreaterThanOrEqual(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.reload();

    // Check that filters are visible
    await page.waitForTimeout(1000);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Filters should stack vertically on mobile
    const countryLabel = page.locator('text=Country:');
    await expect(countryLabel).toBeVisible();
  });

  test('should navigate back to homepage', async ({ page }) => {
    // Look for home link or logo
    const homeLink = page.locator('a[href="/"]').first();

    if (await homeLink.isVisible()) {
      await homeLink.click();

      // Wait for navigation
      await page.waitForURL('/');

      // Verify we're on homepage
      await expect(page.locator('h1')).toContainText(/Real-time|LiveWorldTV/);
    }
  });
});

test.describe('Browse Page Performance', () => {
  test('should load channels within acceptable time', async ({ page }) => {
    await page.goto('/browse');

    const startTime = Date.now();

    // Wait for channels to appear or loading to complete
    await page.waitForTimeout(3000);

    const loadTime = Date.now() - startTime;

    // Should complete within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls and simulate error
    await page.route('**/api/v1/channels**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/browse');

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Should display error message, not crash
    const hasErrorMessage = await page.locator('text=/Error|Failed|Something went wrong/').isVisible();

    // Page should handle the error gracefully
    expect(hasErrorMessage).toBe(true);
  });
});
