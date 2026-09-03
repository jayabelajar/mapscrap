import { chromium, type Browser, type Page } from 'playwright'
import type { BrowserWindow } from 'electron'
import type {
  BusinessRecord,
  ScrapeFormData,
  ScrapeProgressPayload,
  SettingsData
} from '../shared/types'
import { sleep } from './utils'

type JobControl = {
  paused: boolean
  stopped: boolean
}

type ScrapeHandlers = {
  onProgress: (payload: ScrapeProgressPayload) => void
  onBatch: (records: Omit<BusinessRecord, 'id' | 'scrapedAt'>[]) => void
}

function toUserFacingError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes("Executable doesn't exist")) {
      return new Error(
        'Chromium Playwright belum terpasang. Jalankan: npx playwright install chromium'
      )
    }

    if (
      error.message.includes('Target page, context or browser has been closed') ||
      error.message.includes('Browser closed')
    ) {
      return new Error('Scrape stopped')
    }

    return error
  }

  return new Error('Unknown scraper error')
}

function parseCoordinateFromUrl(url: string): {
  latitude: number | null
  longitude: number | null
} {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (!match) {
    return { latitude: null, longitude: null }
  }

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2])
  }
}

async function textContent(page: Page, selector: string): Promise<string> {
  const locator = page.locator(selector).first()
  if ((await locator.count()) === 0) {
    return ''
  }

  const value = await locator.textContent()
  return value?.trim() ?? ''
}

async function attribute(page: Page, selector: string, name: string): Promise<string> {
  const locator = page.locator(selector).first()
  if ((await locator.count()) === 0) {
    return ''
  }

  return (await locator.getAttribute(name))?.trim() ?? ''
}

async function waitWhilePaused(control: JobControl): Promise<void> {
  while (control.paused && !control.stopped) {
    await sleep(250)
  }
}

async function collectPlaceUrls(
  page: Page,
  maxResults: number,
  control: JobControl
): Promise<string[]> {
  // If Google Maps directly loaded a single place page instead of a list
  if (page.url().includes('/maps/place/')) {
    return [page.url()]
  }

  const urls = new Set<string>()
  const listSelectors = ['div[role="feed"]', 'div.m6QEdf[aria-label]', 'div.m6QEdf']
  let activeListSelector = ''

  for (const selector of listSelectors) {
    if ((await page.locator(selector).count()) > 0) {
      activeListSelector = selector
      break
    }
  }

  if (!activeListSelector) {
    try {
      await page.waitForSelector('div[role="feed"], div.m6QEdf', { timeout: 10000 })
      for (const selector of listSelectors) {
        if ((await page.locator(selector).count()) > 0) {
          activeListSelector = selector
          break
        }
      }
    } catch {
      // Check if redirected to a place during wait
      if (page.url().includes('/maps/place/')) {
        return [page.url()]
      }
    }
  }

  if (!activeListSelector) {
    // Fallback: search links directly on page
    const anchors = await page
      .locator('a[href*="/maps/place/"]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).href))
    for (const url of anchors) {
      if (url) {
        urls.add(url)
      }
      if (urls.size >= maxResults) {
        break
      }
    }
    return Array.from(urls).slice(0, maxResults)
  }

  let noNewResultsCount = 0
  while (urls.size < maxResults && !control.stopped && noNewResultsCount < 5) {
    await waitWhilePaused(control)

    const initialSize = urls.size
    const anchors = await page
      .locator('a[href*="/maps/place/"]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).href))

    for (const url of anchors) {
      if (url) {
        urls.add(url)
      }
      if (urls.size >= maxResults) {
        break
      }
    }

    if (urls.size === initialSize) {
      noNewResultsCount += 1
    } else {
      noNewResultsCount = 0
    }

    const feed = page.locator(activeListSelector).first()
    const previousHeight = await feed.evaluate((node) => node.scrollHeight).catch(() => 0)
    await feed.evaluate((node) => node.scrollBy(0, node.scrollHeight)).catch(() => undefined)
    await page.waitForTimeout(1200)
    const nextHeight = await feed.evaluate((node) => node.scrollHeight).catch(() => 0)
    if (nextHeight === previousHeight && urls.size >= maxResults) {
      break
    }
  }

  return Array.from(urls).slice(0, maxResults)
}

function cleanPhone(raw: string): string {
  if (!raw) return ''
  // Strip non-printable unicode, glyphs, and special icon characters
  let text = raw.replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF\u202D\u202C\u200E\u200F]/g, '')
  text = text.replace(/[^\d+()\s-]/g, '').trim()
  text = text.replace(/\s+/g, ' ')
  // Basic validation: must contain at least 5 digits
  const digitCount = (text.match(/\d/g) || []).length
  return digitCount >= 5 ? text : ''
}

function cleanAddress(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g, '')
  // Strip Google Maps Plus Codes at start (e.g., "7QGV+5W ")
  text = text.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, '')
  text = text.replace(/^[📍\s]+/, '').trim()
  return text
}

async function scrapePlace(
  page: Page,
  url: string
): Promise<Omit<BusinessRecord, 'id' | 'scrapedAt'>> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

  const name =
    (await textContent(page, 'h1.DUwfxb')) ||
    (await textContent(page, 'h1.fontHeadlineLarge')) ||
    (await textContent(page, 'h1'))

  const category =
    (await textContent(page, 'button[jsaction*="pane.rating.category"]')) ||
    (await textContent(page, 'button[jsaction*="category"]')) ||
    (await textContent(page, 'span.DkA2fd'))

  const rawAddress =
    (await textContent(page, 'button[data-item-id="address"]')) ||
    (await textContent(page, 'div[data-item-id="address"]')) ||
    (await attribute(page, 'button[data-item-id="address"]', 'aria-label'))

  const rawPhone =
    (await textContent(page, 'button[data-item-id^="phone"]')) ||
    (await textContent(page, 'div[data-item-id^="phone"]')) ||
    (await attribute(page, 'button[data-item-id^="phone"]', 'aria-label'))

  const website =
    (await attribute(page, 'a[data-item-id="authority"]', 'href')) ||
    (await attribute(page, 'a[aria-label*="website"]', 'href'))

  // Enhanced rating extractors
  let ratingText =
    (await textContent(page, 'div.F7v250')) ||
    (await textContent(page, 'span.ceNzKf')) ||
    (await textContent(page, 'div[role="main"] span[role="img"]')) ||
    (await attribute(page, 'span[role="img"][aria-label*="star"]', 'aria-label')) ||
    (await attribute(page, 'span[role="img"][aria-label*="bintang"]', 'aria-label'))

  if (!ratingText) {
    // Try inner text from rating buttons/divs
    const firstRatingLoc = page.locator('div[role="main"] span[aria-hidden="true"]').first()
    if ((await firstRatingLoc.count()) > 0) {
      ratingText = (await firstRatingLoc.textContent()) || ''
    }
  }

  const reviewText =
    (await textContent(page, 'button[jsaction*="pane.reviewChart.moreReviews"]')) ||
    (await textContent(page, 'button[jsaction*="reviews"]')) ||
    (await textContent(page, 'span[aria-label*="reviews"]')) ||
    (await textContent(page, 'span[aria-label*="ulasan"]'))

  const { latitude, longitude } = parseCoordinateFromUrl(page.url())

  const ratingMatch = ratingText.match(/([\d.,]+)/)
  const reviewMatch = reviewText.replace(/[^\d]/g, '')

  let parsedRating: number | null = null
  if (ratingMatch) {
    const normalizedRating = parseFloat(ratingMatch[1].replace(',', '.'))
    if (!isNaN(normalizedRating) && normalizedRating >= 1.0 && normalizedRating <= 5.0) {
      parsedRating = normalizedRating
    }
  }

  const phone = cleanPhone(rawPhone)
  const address = cleanAddress(rawAddress)

  return {
    runId: '',
    name: name || 'Tanpa Nama',
    category: category || '',
    address,
    phone,
    website: website || '',
    rating: parsedRating,
    reviewCount: reviewMatch ? Number(reviewMatch) : null,
    mapsUrl: page.url(),
    latitude,
    longitude
  }
}

export class GoogleMapsScraper {
  private browser: Browser | null = null

  async run(
    mainWindow: BrowserWindow,
    runId: string,
    form: ScrapeFormData,
    settings: SettingsData,
    control: JobControl,
    handlers: ScrapeHandlers
  ): Promise<void> {
    try {
      this.browser = await chromium.launch({ headless: settings.headless })
      const page = await this.browser.newPage()
      page.setDefaultTimeout(settings.timeoutMs)

      const query = encodeURIComponent(`${form.keyword} ${form.location}`)
      handlers.onProgress({
        runId,
        status: 'running',
        current: 0,
        total: form.maxResults,
        message: 'Membuka Google Maps...'
      })

      await page.goto(`https://www.google.com/maps/search/${query}`, {
        waitUntil: 'domcontentloaded',
        timeout: settings.timeoutMs
      })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

      const urls = await collectPlaceUrls(page, form.maxResults, control)
      
      if (urls.length === 0) {
        handlers.onProgress({
          runId,
          status: 'completed',
          current: 0,
          total: form.maxResults,
          message: 'Tidak ditemukan lokasi sesuai keyword'
        })
        await page.close()
        return
      }

      const detailPage = await this.browser.newPage()
      detailPage.setDefaultTimeout(settings.timeoutMs)

      for (let index = 0; index < urls.length; index += 1) {
        if (control.stopped) {
          break
        }

        await waitWhilePaused(control)
        const raw = await scrapePlace(detailPage, urls[index])
        const record = { ...raw, runId }
        handlers.onBatch([record])
        handlers.onProgress({
          runId,
          status: control.paused ? 'paused' : 'running',
          current: index + 1,
          total: form.maxResults,
          message: `Mengumpulkan data (${index + 1}/${Math.min(urls.length, form.maxResults)})`
        })
        mainWindow.webContents.send('scrape:result', record)
        await sleep(settings.delayMs)
      }

      await detailPage.close()
      await page.close()
    } catch (error) {
      throw toUserFacingError(error)
    } finally {
      await this.close()
    }
  }

  async close(): Promise<void> {
    await this.browser?.close()
    this.browser = null
  }
}

