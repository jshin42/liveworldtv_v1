# End-to-End Testing for LiveWorldTV

Comprehensive e2e test suite using Playwright that works with **any domain** configuration.

## Overview

This test suite is **domain-agnostic** and supports testing across:
- **Local development** (localhost:3000)
- **Staging environments** (staging.dubworld.tv)
- **Production domains** (dubworld.tv, liveworld.tv, or custom domains)

## Quick Start

### 1. Install Playwright

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### 2. Configure Environment Variables

Create `.env.local` for local testing or `.env.production` for production testing:

```bash
# .env.local (Development)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=LiveWorldTV
NEXT_PUBLIC_ENABLE_DUBBING=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

```bash
# .env.production (Production - DubWorld.tv example)
NEXT_PUBLIC_API_URL=https://api.dubworld.tv
NEXT_PUBLIC_SITE_URL=https://dubworld.tv
NEXT_PUBLIC_SITE_NAME=DubWorld
NEXT_PUBLIC_ENABLE_DUBBING=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=dubworld.tv
```

### 3. Run Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Test Structure

### Test Files

```
e2e/
├── homepage.spec.ts          # Homepage autoplay and core features
├── browse.spec.ts            # Channel browsing and filtering
├── dubbing.spec.ts           # AI-powered dubbing functionality
├── multi-domain.spec.ts      # Cross-domain configuration tests
└── README.md                 # This file
```

### Test Coverage

#### `homepage.spec.ts`
- ✅ Homepage loads successfully
- ✅ Autoplay feature section displays
- ✅ Navigation to browse page works
- ✅ Random channel loads
- ✅ API documentation link
- ✅ Responsive mobile layout
- ✅ Dubbing controls UI
- ✅ Performance (load time < 5s)
- ✅ No console errors on load

#### `browse.spec.ts`
- ✅ Browse page loads successfully
- ✅ Country filter displays and works
- ✅ Topic filter displays and works
- ✅ Channels load and display
- ✅ Channel cards show key information
- ✅ Links to channel pages work
- ✅ No results state handled
- ✅ Responsive mobile layout
- ✅ API error handling
- ✅ Performance (channels load < 5s)

#### `dubbing.spec.ts`
- ✅ Dubbing controls display
- ✅ Status indicator shows
- ✅ Language selection options
- ✅ Service initializes in browser
- ✅ Browser compatibility check
- ✅ Volume controls
- ✅ Toggle dubbing on/off
- ✅ Error handling
- ✅ Caption availability status
- ✅ YouTube player integration
- ✅ Caption processing
- ✅ Sync with video playback
- ✅ Performance (initialization < 5s)

#### `multi-domain.spec.ts`
- ✅ Correct API URL from environment
- ✅ API calls to configured backend
- ✅ CORS handling
- ✅ Localhost development setup
- ✅ Production domain setup (HTTPS)
- ✅ Site name from environment
- ✅ Subdomain routing
- ✅ www/non-www variants
- ✅ Analytics configuration
- ✅ Environment variable validation
- ✅ Secure protocols in production

## Testing Different Domains

### Testing DubWorld.tv

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.dubworld.tv
NEXT_PUBLIC_SITE_URL=https://dubworld.tv
NEXT_PUBLIC_SITE_NAME=DubWorld

# Run tests
npm run test:e2e
```

### Testing LiveWorld.tv

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.liveworld.tv
NEXT_PUBLIC_SITE_URL=https://liveworld.tv
NEXT_PUBLIC_SITE_NAME=LiveWorld

# Run tests
npm run test:e2e
```

### Testing Custom Domain

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.yourdomain.tv
NEXT_PUBLIC_SITE_URL=https://yourdomain.tv
NEXT_PUBLIC_SITE_NAME=YourBrand

# Run tests
npm run test:e2e
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run e2e tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          NEXT_PUBLIC_SITE_URL: ${{ secrets.SITE_URL }}
          NEXT_PUBLIC_SITE_NAME: LiveWorldTV

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Browser Support

Tests run on:
- ✅ Chromium (Chrome, Edge)
- ✅ Firefox
- ✅ WebKit (Safari)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

## Writing New Tests

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Use environment variables for domain-agnostic testing
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Your test logic
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Best Practices

1. **Use Environment Variables**: Always use `process.env.NEXT_PUBLIC_*` for URLs
2. **Handle Async Operations**: Use `waitForTimeout()` or better selectors
3. **Graceful Degradation**: Tests should handle missing features/data
4. **Meaningful Assertions**: Test behavior, not implementation
5. **Mobile Testing**: Include responsive viewport tests
6. **Performance Testing**: Set reasonable timeout expectations
7. **Error Handling**: Verify errors are handled gracefully

## Debugging

### Visual Debugging

```bash
# Open Playwright Inspector
npm run test:e2e:debug

# Run with browser visible
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui
```

### Screenshots and Videos

Failed tests automatically capture:
- 📸 Screenshots (`screenshot: 'only-on-failure'`)
- 🎥 Videos (`video: 'retain-on-failure'`)
- 🔍 Traces (`trace: 'on-first-retry'`)

Located in: `test-results/`

## Performance Targets

Based on project quality targets:

- **Page Load**: < 5 seconds
- **API Response**: < 2 seconds
- **Dubbing Initialization**: < 5 seconds
- **Channel Loading**: < 3 seconds
- **First Meaningful Paint**: < 3 seconds

## Troubleshooting

### Tests Fail with CORS Errors

**Solution**: Ensure API `.env` includes your frontend domain in `CORS_ORIGIN`:

```bash
# apps/api/.env
CORS_ORIGIN=http://localhost:3000,https://dubworld.tv
```

### Tests Fail with "Cannot connect to API"

**Solution**: Verify API is running and URL is correct:

```bash
# Check API status
curl http://localhost:3001/api/v1/health

# Verify environment variable
echo $NEXT_PUBLIC_API_URL
```

### YouTube Player Tests Fail

**Solution**: YouTube IFrame API can be flaky. Tests include:
- Longer timeouts for external resources
- Graceful handling of YouTube load failures
- Fallback checks for player initialization

### Browser Not Found

**Solution**: Install Playwright browsers:

```bash
npx playwright install
```

## Contributing

When adding new features:

1. **Write e2e tests first** (TDD approach)
2. **Use domain-agnostic configuration**
3. **Test across multiple browsers**
4. **Include mobile viewport tests**
5. **Document new test files in this README**

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Next.js Testing](https://nextjs.org/docs/testing)
- [Project Quality Targets](../../CLAUDE.md#quality-targets)
- [Domain Strategy](../../DOMAIN_STRATEGY.md)

## Support

For issues or questions:
- Check [Playwright Docs](https://playwright.dev/docs/intro)
- Review [GitHub Issues](https://github.com/yourusername/liveworldtv/issues)
- See project documentation in `/docs`
