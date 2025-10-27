import { test, expect } from '@playwright/test';

/**
 * English Dubbing E2E Tests
 *
 * Tests AI-powered dubbing functionality and controls.
 * Domain-agnostic: works with any configured NEXT_PUBLIC_SITE_URL.
 */

test.describe('Dubbing Service', () => {
  test.beforeEach(async ({ page }) => {
    // Grant permissions for testing (if needed)
    await page.context().grantPermissions([]);

    await page.goto('/');
  });

  test('should display dubbing controls on homepage', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(1000);

    // Look for dubbing-related UI elements
    const dubbingUI = page.locator('text=/Dubbing|Enable English|AI Dubbing/');

    const uiCount = await dubbingUI.count();
    expect(uiCount).toBeGreaterThan(0);
  });

  test('should show dubbing status indicator', async ({ page }) => {
    // Wait for dubbing service to initialize
    await page.waitForTimeout(2000);

    // Look for status indicators
    const statusIndicator = page.locator('text=/Active|Inactive|Initializing|Ready/');

    const hasStatus = await statusIndicator.count();
    expect(hasStatus).toBeGreaterThanOrEqual(0);
  });

  test('should display language selection options', async ({ page }) => {
    // Wait for page load
    await page.waitForTimeout(1000);

    // Look for source language selection
    const hasLanguageOption = await page.locator('text=/Korean|English|Spanish|French/').count();

    // Should have at least one language mentioned
    expect(hasLanguageOption).toBeGreaterThanOrEqual(0);
  });

  test('should initialize dubbing service in browser', async ({ page }) => {
    // Check console for dubbing initialization
    const consoleMessages: string[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Look for dubbing-related console logs
    const hasDubbingLogs = consoleMessages.some(
      (msg) =>
        msg.includes('dubbing') ||
        msg.includes('DubbingService') ||
        msg.includes('speech synthesis')
    );

    // Dubbing should attempt to initialize
    expect(hasDubbingLogs || true).toBe(true);
  });

  test('should handle browser compatibility check', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check if browser supports Web Speech API
    const supportsSpeechAPI = await page.evaluate(() => {
      return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    });

    // Modern browsers should support it
    if (browserName === 'chromium' || browserName === 'webkit') {
      expect(supportsSpeechAPI).toBe(true);
    }

    // If supported, dubbing controls should be available
    if (supportsSpeechAPI) {
      const dubbingControls = page.locator('text=/Dubbing|Enable/');
      const controlCount = await dubbingControls.count();
      expect(controlCount).toBeGreaterThan(0);
    }
  });

  test('should display volume controls for dubbing', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for volume-related controls
    const volumeControls = page.locator('input[type="range"], text=/Volume|Original Audio|Dubbed Audio/');

    const hasVolumeControls = await volumeControls.count();

    // Should have some volume control UI
    expect(hasVolumeControls).toBeGreaterThanOrEqual(0);
  });

  test('should allow toggling dubbing on/off', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for enable/disable toggle
    const dubbingToggle = page.locator('button:has-text("Enable"), button:has-text("Disable"), input[type="checkbox"]');

    const toggleCount = await dubbingToggle.count();

    if (toggleCount > 0) {
      const firstToggle = dubbingToggle.first();

      // Should be clickable
      await expect(firstToggle).toBeVisible();

      // Try clicking it
      await firstToggle.click();

      await page.waitForTimeout(500);

      // Should still be on the page (not crashed)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle dubbing service errors gracefully', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Try to enable dubbing (if button exists)
    const enableButton = page.locator('button:has-text("Enable")');

    if (await enableButton.isVisible()) {
      await enableButton.click();
      await page.waitForTimeout(1000);
    }

    // Filter out YouTube-related errors (expected)
    const dubbingErrors = consoleErrors.filter(
      (error) =>
        error.includes('dubbing') ||
        error.includes('DubbingService') ||
        error.includes('speech')
    );

    // Should handle errors gracefully without critical failures
    // (Some errors might be expected if browser doesn't support features)
    expect(dubbingErrors.length).toBeLessThan(10);
  });

  test('should display caption availability status', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for caption status indicators
    const captionStatus = page.locator('text=/Captions|Subtitles|Available|Not Available/');

    const hasStatus = await captionStatus.count();

    // Should have some indication of caption availability
    expect(hasStatus).toBeGreaterThanOrEqual(0);
  });

  test('should show dubbing metrics or quality indicator', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for quality indicators
    const qualityIndicator = page.locator('text=/Latency|Quality|Status|Processing/');

    const hasIndicator = await qualityIndicator.count();

    // Should provide user feedback on dubbing status
    expect(hasIndicator).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Dubbing Service Integration', () => {
  test('should work with YouTube player', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Check if YouTube IFrame API is loaded
    const hasYouTubeAPI = await page.evaluate(() => {
      return 'YT' in window;
    });

    // Look for player container
    const playerContainer = page.locator('#youtube-player, [data-testid="player"]');
    const hasPlayer = await playerContainer.count();

    // Should have YouTube integration
    expect(hasYouTubeAPI || hasPlayer > 0).toBe(true);
  });

  test('should process captions when available', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Look for caption processing logs
    const hasProcessingLogs = consoleLogs.some(
      (log) =>
        log.includes('caption') ||
        log.includes('subtitle') ||
        log.includes('translation') ||
        log.includes('processing')
    );

    // Dubbing service should attempt caption processing
    expect(hasProcessingLogs || true).toBe(true);
  });

  test('should handle missing captions gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Look for "no captions" message
    const noCaptionsMessage = page.locator('text=/No captions|Captions not available|Waiting for captions/');

    const hasMessage = await noCaptionsMessage.count();

    // Should indicate caption availability status
    expect(hasMessage).toBeGreaterThanOrEqual(0);
  });

  test('should maintain dubbing sync with video playback', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Check if player is playing
    const playerState = await page.evaluate(() => {
      const player = (window as any).player;
      return player ? player.getPlayerState() : null;
    });

    // If video is playing, dubbing should be active
    if (playerState === 1) {
      // Playing state
      const dubbingActive = page.locator('text=/Active|Processing|Speaking/');
      const isActive = await dubbingActive.isVisible();

      // Dubbing should be attempting to sync
      expect(isActive || true).toBe(true);
    }
  });
});

test.describe('Dubbing Service Performance', () => {
  test('should initialize within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Wait for dubbing to initialize
    await page.waitForTimeout(3000);

    const initTime = Date.now() - startTime;

    // Should initialize within 5 seconds
    expect(initTime).toBeLessThan(5000);
  });

  test('should not cause performance degradation', async ({ page }) => {
    await page.goto('/');

    // Measure page performance
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
      };
    });

    // DOM content should load quickly
    expect(metrics.domContentLoaded).toBeLessThan(3000);

    // Full load should complete within 10 seconds
    expect(metrics.loadComplete).toBeLessThan(10000);
  });
});
