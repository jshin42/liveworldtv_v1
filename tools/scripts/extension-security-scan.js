#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

class ExtensionSecurityScanner {
  constructor() {
    this.extensionPath = path.join(__dirname, '../../apps/extension')
    this.issues = []
    this.warnings = []
  }

  scan() {
    console.log('🔍 Starting Chrome extension security scan...')
    
    this.checkManifestSecurity()
    this.checkContentScriptSecurity()
    this.checkBackgroundScriptSecurity()
    this.checkPermissions()
    
    this.reportFindings()
    
    return this.issues.length === 0
  }

  checkManifestSecurity() {
    const manifestPath = path.join(this.extensionPath, 'manifest.json')
    
    if (!fs.existsSync(manifestPath)) {
      this.issues.push('manifest.json not found')
      return
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    
    // Check CSP
    if (!manifest.content_security_policy?.extension_pages) {
      this.issues.push('Missing Content Security Policy for extension pages')
    } else {
      const csp = manifest.content_security_policy.extension_pages
      if (csp.includes("'unsafe-eval'") && !csp.includes("'wasm-unsafe-eval'")) {
        this.issues.push("Unsafe 'unsafe-eval' in CSP - use 'wasm-unsafe-eval' for WebAssembly only")
      }
    }
    
    // Check permissions
    const permissions = manifest.permissions || []
    const sensitivePerms = ['tabs', 'activeTab', 'history', 'cookies']
    const foundSensitive = permissions.filter(p => sensitivePerms.includes(p))
    
    if (foundSensitive.length > 0) {
      this.warnings.push(`Sensitive permissions detected: ${foundSensitive.join(', ')}`)
    }
    
    // Check host permissions
    const hostPerms = manifest.host_permissions || []
    const broadPerms = hostPerms.filter(p => p.includes('*://*/*') || p.includes('<all_urls>'))
    
    if (broadPerms.length > 0) {
      this.issues.push(`Overly broad host permissions: ${broadPerms.join(', ')}`)
    }
  }

  checkContentScriptSecurity() {
    const contentScriptPath = path.join(this.extensionPath, 'src/content/content.ts')
    
    if (!fs.existsSync(contentScriptPath)) {
      this.warnings.push('Content script not found for security review')
      return
    }

    const content = fs.readFileSync(contentScriptPath, 'utf8')
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, message: 'eval() usage detected' },
      { pattern: /innerHTML\s*=/g, message: 'innerHTML assignment detected - prefer textContent or safe DOM methods' },
      { pattern: /document\.write\s*\(/g, message: 'document.write() usage detected' },
      { pattern: /\.postMessage\s*\(/g, message: 'postMessage usage - ensure origin validation' }
    ]

    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        this.warnings.push(`Content script: ${message}`)
      }
    })
  }

  checkBackgroundScriptSecurity() {
    const backgroundPath = path.join(this.extensionPath, 'src/background/background.ts')
    
    if (!fs.existsSync(backgroundPath)) {
      this.warnings.push('Background script not found for security review')
      return
    }

    const content = fs.readFileSync(backgroundPath, 'utf8')
    
    // Check for dangerous patterns
    if (/fetch\s*\(/g.test(content)) {
      const hasUrlValidation = /\/\*.*url.*validation.*\*\/|\/\/.*validate.*url/i.test(content)
      if (!hasUrlValidation) {
        this.warnings.push('Background script: fetch() calls without visible URL validation comments')
      }
    }
    
    // Check for storage of sensitive data
    if (/chrome\.storage.*password|chrome\.storage.*token|chrome\.storage.*key/i.test(content)) {
      this.issues.push('Background script: potential sensitive data storage detected')
    }
  }

  checkPermissions() {
    const manifestPath = path.join(this.extensionPath, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    
    const permissions = manifest.permissions || []
    const requiredForFeatures = ['tabCapture', 'storage', 'offscreen']
    
    requiredForFeatures.forEach(perm => {
      if (!permissions.includes(perm)) {
        this.issues.push(`Missing required permission: ${perm}`)
      }
    })
  }

  reportFindings() {
    console.log('\n📊 Security Scan Results:')
    
    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ No security issues found')
      return
    }
    
    if (this.issues.length > 0) {
      console.log('\n❌ Security Issues:')
      this.issues.forEach(issue => console.log(`  • ${issue}`))
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Security Warnings:')
      this.warnings.forEach(warning => console.log(`  • ${warning}`))
    }
    
    console.log('\n📋 Recommendations:')
    console.log('  • Review all permissions and ensure they match features')
    console.log('  • Implement input validation for all user-facing APIs')
    console.log('  • Use restrictive Content Security Policy')
    console.log('  • Validate all external URLs before fetch operations')
    console.log('  • Never store sensitive data in chrome.storage without encryption')
  }
}

// Run scan
const scanner = new ExtensionSecurityScanner()
const passed = scanner.scan()

process.exit(passed ? 0 : 1)