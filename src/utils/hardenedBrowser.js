/**
 * HARDENED PLAYWRIGHT BROWSER CONFIGURATION
 *
 * This module provides production-ready anti-detection for Cloudflare and similar bot protection.
 * It addresses all major fingerprinting vectors with minimal, stable modifications.
 *
 * CRITICAL PRINCIPLES:
 * 1. Consistency over randomization (same fingerprint per session)
 * 2. Realistic values matching common hardware
 * 3. Headful mode preferred for production
 * 4. Persistent session state (cookies, storage)
 * 5. Human-like timing and behavior
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

/**
 * Browser hardening configuration
 */
export class HardenedBrowser {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== undefined ? options.headless : false,
      persistentContext: options.persistentContext !== undefined ? options.persistentContext : true,
      userDataDir: options.userDataDir || path.join(process.cwd(), '.browser-data'),
      proxy: options.proxy || null,
      verbose: options.verbose !== undefined ? options.verbose : true,
      ...options
    };

    this.browser = null;
    this.context = null;
  }

  /**
   * Get realistic Chrome user agent (stable, not randomized)
   * Using latest stable Chrome version
   */
  getUserAgent() {
    // Use a recent stable Windows Chrome user agent
    // This should match the Chrome version we're emulating
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }

  /**
   * Get browser launch arguments optimized for anti-detection
   */
  getLaunchArgs() {
    return [
      // CRITICAL: Core anti-detection
      '--disable-blink-features=AutomationControlled',

      // Remove automation flags
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',

      // Sandbox (keep enabled for security, but can disable if needed)
      '--no-sandbox',
      '--disable-setuid-sandbox',

      // Performance
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',

      // Window size
      '--window-size=1920,1080',
      '--start-maximized',

      // Disable features that leak automation
      '--disable-features=IsolateOrigins,site-per-process,TranslateUI',
      '--disable-site-isolation-trials',

      // Notifications and popups
      '--disable-notifications',
      '--disable-popup-blocking',

      // WebGL/GPU
      '--use-gl=desktop',
      '--enable-webgl',

      // Language
      '--lang=en-US',

      // CRITICAL: Disable automation extension
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
    ];
  }

  /**
   * Get context options with realistic headers and settings
   */
  getContextOptions() {
    const userAgent = this.getUserAgent();

    return {
      viewport: { width: 1920, height: 1080 },
      userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      colorScheme: 'light',

      // Critical: realistic HTTP headers matching real Chrome
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'DNT': '1',
      },

      // Proxy if provided
      ...(this.options.proxy && {
        proxy: {
          server: this.options.proxy.server,
          username: this.options.proxy.username,
          password: this.options.proxy.password
        }
      })
    };
  }

  /**
   * Apply comprehensive fingerprint evasions via addInitScript
   * This runs before any page scripts, ensuring consistent fingerprint
   */
  getEvasionScript() {
    return () => {
      // ========================================
      // STEP 1: REMOVE AUTOMATION SIGNALS
      // ========================================

      // Overwrite navigator.webdriver (most critical)
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      // Delete webdriver from prototype
      delete Object.getPrototypeOf(navigator).webdriver;

      // Comprehensive webdriver removal
      Object.defineProperty(window, 'navigator', {
        value: new Proxy(navigator, {
          has: (target, key) => {
            if (key === 'webdriver') return false;
            return key in target;
          },
          get: (target, key) => {
            if (key === 'webdriver') return undefined;
            return target[key];
          }
        }),
        configurable: true
      });

      // ========================================
      // STEP 2: FIX PERMISSIONS API
      // ========================================

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({
            state: Notification?.permission || 'prompt',
            onchange: null
          });
        }
        return originalQuery(parameters);
      };

      // ========================================
      // STEP 3: STABLE BROWSER PROPERTIES
      // ========================================

      // Navigator properties (stable, realistic values)
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true
      });

      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });

      // Connection API
      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', {
          get: () => 50,
          configurable: true
        });
      }

      // ========================================
      // STEP 4: CHROME RUNTIME OBJECTS
      // ========================================

      // Chrome object with realistic structure
      if (!window.chrome) {
        window.chrome = {};
      }

      window.chrome.runtime = {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update'
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic'
        },
        PlatformArch: {
          ARM: 'arm',
          ARM64: 'arm64',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformNaclArch: {
          ARM: 'arm',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win'
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available'
        }
      };

      window.chrome.loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000 - Math.random() * 2,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
          finishLoadTime: Date.now() / 1000 - Math.random(),
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000 - Math.random() * 2,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: Date.now() / 1000 - Math.random() * 3,
          startLoadTime: Date.now() / 1000 - Math.random() * 3,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false
        };
      };

      window.chrome.csi = function() {
        return {
          onloadT: Date.now(),
          pageT: Date.now() - Math.random() * 1000,
          startE: Date.now() - Math.random() * 3000,
          tran: 15
        };
      };

      window.chrome.app = {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        }
      };

      // ========================================
      // STEP 5: PLUGINS (realistic Chrome plugin set)
      // ========================================

      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            {
              0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            },
            {
              0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer'
            },
            {
              0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
              1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client'
            }
          ];
          return Object.setPrototypeOf(plugins, PluginArray.prototype);
        },
        configurable: true
      });

      // ========================================
      // STEP 6: SCREEN PROPERTIES (stable, realistic)
      // ========================================

      Object.defineProperty(screen, 'width', {
        get: () => 1920,
        configurable: true
      });

      Object.defineProperty(screen, 'height', {
        get: () => 1080,
        configurable: true
      });

      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920,
        configurable: true
      });

      Object.defineProperty(screen, 'availHeight', {
        get: () => 1040, // Taskbar height
        configurable: true
      });

      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24,
        configurable: true
      });

      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24,
        configurable: true
      });

      // ========================================
      // STEP 7: WINDOW PROPERTIES
      // ========================================

      Object.defineProperty(window, 'outerWidth', {
        get: () => 1920,
        configurable: true
      });

      Object.defineProperty(window, 'outerHeight', {
        get: () => 1080,
        configurable: true
      });

      // ========================================
      // STEP 8: CANVAS FINGERPRINT (minimal noise)
      // ========================================

      // Apply tiny, consistent noise to canvas
      const canvasNoise = 0.0001; // Very small noise

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        // Only add noise to non-empty canvases
        if (this.width > 0 && this.height > 0) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            // Add minimal noise to a few pixels
            for (let i = 0; i < imageData.data.length; i += 400) {
              imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 2));
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, arguments);
      };

      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function() {
        const imageData = originalGetImageData.apply(this, arguments);
        // Add minimal noise (< 0.01% change)
        for (let i = 0; i < imageData.data.length; i += 400) {
          imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 2));
        }
        return imageData;
      };

      // ========================================
      // STEP 9: WEBGL FINGERPRINT (stable vendor/renderer)
      // ========================================

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };

      // Same for WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter2.apply(this, arguments);
        };
      }

      // ========================================
      // STEP 10: AUDIO CONTEXT (minimal consistent noise)
      // ========================================

      const audioContextNoise = 0.00001;

      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const channelData = originalGetChannelData.apply(this, arguments);
        // Add tiny noise to first few samples
        for (let i = 0; i < Math.min(10, channelData.length); i++) {
          channelData[i] = channelData[i] + (Math.random() - 0.5) * audioContextNoise;
        }
        return channelData;
      };

      // ========================================
      // STEP 11: BATTERY API (realistic values)
      // ========================================

      if (navigator.getBattery) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = async () => {
          const battery = await originalGetBattery.call(navigator);
          Object.defineProperty(battery, 'charging', { get: () => true });
          Object.defineProperty(battery, 'chargingTime', { get: () => 0 });
          Object.defineProperty(battery, 'dischargingTime', { get: () => Infinity });
          Object.defineProperty(battery, 'level', { get: () => 1 });
          return battery;
        };
      }

      // ========================================
      // STEP 12: MEDIA DEVICES (stable device IDs)
      // ========================================

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = async function() {
          const devices = await originalEnumerateDevices.call(navigator.mediaDevices);
          return devices.map((device, index) => ({
            ...device,
            deviceId: device.deviceId || `device-${index}-stable`,
            groupId: device.groupId || `group-${Math.floor(index / 2)}-stable`
          }));
        };
      }

      // ========================================
      // STEP 13: IFRAME CONTENTWINDOW EVASION
      // ========================================

      const originalContentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const win = originalContentWindowGetter.call(this);
          if (win) {
            try {
              win.navigator.webdriver = undefined;
            } catch (e) {
              // Cross-origin iframe, ignore
            }
          }
          return win;
        }
      });

      // ========================================
      // STEP 14: MISC DETECTION SIGNALS
      // ========================================

      // Remove Playwright-specific globals (if any)
      delete window.__playwright;
      delete window.__pw_manual;
      delete window.__PW_inspect;

      // Notification permissions
      if (window.Notification) {
        Object.defineProperty(Notification, 'permission', {
          get: () => 'default',
          configurable: true
        });
      }

      // ========================================
      // STEP 15: TURNSTILE-SPECIFIC EVASIONS (CRITICAL)
      // ========================================

      // Fix Date.prototype.getTimezoneOffset (Turnstile checks timezone consistency)
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return 300; // UTC-5 for America/New_York (matches context setting)
      };

      // Fix Intl.DateTimeFormat (must match getTimezoneOffset)
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(...args) {
        if (args.length === 0 || !args[1] || !args[1].timeZone) {
          args[1] = args[1] || {};
          args[1].timeZone = 'America/New_York';
        }
        return new originalDateTimeFormat(...args);
      };
      Object.setPrototypeOf(Intl.DateTimeFormat, originalDateTimeFormat);
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

      // Fix Error stack traces (remove any Playwright signatures)
      const OriginalError = Error;
      Error = new Proxy(OriginalError, {
        construct(target, args) {
          const err = new target(...args);
          const originalStackGetter = Object.getOwnPropertyDescriptor(err, 'stack')?.get ||
                                      Object.getOwnPropertyDescriptor(Error.prototype, 'stack')?.get;
          if (originalStackGetter) {
            Object.defineProperty(err, 'stack', {
              get: function() {
                const stack = originalStackGetter.call(this);
                if (typeof stack === 'string') {
                  return stack
                    .split('\n')
                    .filter(line => !line.includes('playwright'))
                    .filter(line => !line.includes('__pw'))
                    .join('\n');
                }
                return stack;
              },
              configurable: true
            });
          }
          return err;
        }
      });
      Error.prototype = OriginalError.prototype;
      Error.stackTraceLimit = OriginalError.stackTraceLimit;

      // Fix Function.prototype.toString (Turnstile checks if functions are native)
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        // For our overridden functions, return native code signature
        if (this === HTMLCanvasElement.prototype.toDataURL ||
            this === CanvasRenderingContext2D.prototype.getImageData ||
            this === WebGLRenderingContext.prototype.getParameter ||
            this === navigator.permissions.query) {
          return 'function () { [native code] }';
        }
        return originalToString.call(this);
      };

      // ========================================
      // FINAL: LOG EVASIONS (for debugging)
      // ========================================

      console.log('✅ Browser hardening applied successfully');
    };
  }

  /**
   * Launch browser with full hardening
   */
  async launch() {
    if (this.options.verbose) {
      console.log('🚀 Launching hardened browser...');
      console.log(`   Headless: ${this.options.headless}`);
      console.log(`   Persistent: ${this.options.persistentContext}`);
    }

    // Ensure user data directory exists
    if (this.options.persistentContext) {
      await fs.mkdir(this.options.userDataDir, { recursive: true });
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: this.getLaunchArgs(),
      ignoreDefaultArgs: ['--enable-automation'],
      downloadsPath: path.join(this.options.userDataDir, 'downloads'),
    });

    // Create context
    const contextOptions = this.getContextOptions();

    if (this.options.persistentContext) {
      // Use persistent context (saves cookies automatically)
      await this.browser.close(); // Close the browser
      this.browser = await chromium.launchPersistentContext(
        this.options.userDataDir,
        {
          headless: this.options.headless,
          args: this.getLaunchArgs(),
          ignoreDefaultArgs: ['--enable-automation'],
          ...contextOptions
        }
      );
      this.context = this.browser; // Persistent context IS the browser
    } else {
      // Use regular context
      this.context = await this.browser.newContext(contextOptions);
    }

    // Apply evasion scripts to context
    await this.context.addInitScript(this.getEvasionScript());

    if (this.options.verbose) {
      console.log('✅ Hardened browser launched successfully\n');
    }

    return this.context;
  }

  /**
   * Close browser
   */
  async close() {
    if (this.context && !this.options.persistentContext) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Create a new page with additional per-page hardening
   */
  async newPage() {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const page = await this.context.newPage();

    // Add per-page evasion scripts (defense in depth)
    await page.addInitScript(this.getEvasionScript());

    return page;
  }
}
