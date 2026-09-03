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
  const urls = new Set<string>()
  const listSelector = 'div[role="feed"]'
  await page.waitForSelector(listSelector, { timeout: 15000 })

  while (urls.size < maxResults && !control.stopped) {
    await waitWhilePaused(control)
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

    const feed = page.locator(listSelector).first()
    const previousHeight = await feed.evaluate((node) => node.scrollHeight)
    await feed.evaluate((node) => node.scrollBy(0, node.scrollHeight))
    await page.waitForTimeout(1200)
    const nextHeight = await feed.evaluate((node) => node.scrollHeight)
    if (nextHeight === previousHeight) {
      break
    }
  }

  return Array.from(urls).slice(0, maxResults)
}

async function scrapePlace(
  page: Page,
  url: string
): Promise<Omit<BusinessRecord, 'id' | 'scrapedAt'>> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

  const name = await textContent(page, 'h1')
  const category = await textContent(page, 'button[jsaction*="pane.rating.category"]')
  const address = await textContent(page, 'button[data-item-id="address"]')
  const phone = await textContent(page, 'button[data-item-id^="phone"]')
  const website = await attribute(page, 'a[data-item-id="authority"]', 'href')
  const ratingText = await textContent(page, 'div[role="main"] span[role="img"]')
  const reviewText = await textContent(page, 'button[jsaction*="pane.reviewChart.moreReviews"]')
  const { latitude, longitude } = parseCoordinateFromUrl(page.url())

  const ratingMatch = ratingText.match(/([\d.]+)/)
  const reviewMatch = reviewText.replace(/[^\d]/g, '')

  return {
    runId: '',
    name,
    category,
    address,
    phone,
    website,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
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
    this.browser = await chromium.launch({ headless: settings.headless })
    const page = await this.browser.newPage()
    page.setDefaultTimeout(settings.timeoutMs)

    const query = encodeURIComponent(`${form.keyword} ${form.location}`)
    handlers.onProgress({
      runId,
      status: 'running',
      current: 0,
      total: form.maxResults,
      message: 'Opening Google Maps'
    })

    await page.goto(`https://www.google.com/maps/search/${query}`, {
      waitUntil: 'domcontentloaded',
      timeout: settings.timeoutMs
    })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

    const urls = await collectPlaceUrls(page, form.maxResults, control)
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
        message: `Collected ${index + 1} of ${form.maxResults}`
      })
      mainWindow.webContents.send('scrape:result', record)
      await sleep(settings.delayMs)
    }

    await detailPage.close()
    await page.close()
    await this.close()
  }

  async close(): Promise<void> {
    await this.browser?.close()
    this.browser = null
  }
}
