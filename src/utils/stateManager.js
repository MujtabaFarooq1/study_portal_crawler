import fs from "fs";
import path from "path";

const STATE_DIR = path.resolve("state");
const STATE_FILE = path.join(STATE_DIR, "crawler-state.json");

/**
 * State Manager for crawler persistence
 * Allows resuming from where we left off
 */
export class StateManager {
  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load state from file or create new state
   */
  loadState() {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    if (fs.existsSync(STATE_FILE)) {
      try {
        const data = fs.readFileSync(STATE_FILE, "utf-8");
        const state = JSON.parse(data);
        console.log("📂 Loaded existing state from disk");
        return state;
      } catch (error) {
        console.error("⚠️  Failed to load state, starting fresh:", error.message);
        return this.createFreshState();
      }
    }

    return this.createFreshState();
  }

  /**
   * Create fresh state structure
   */
  createFreshState() {
    return {
      lastUpdated: new Date().toISOString(),
      currentPhase: "masters", // 'masters' or 'bachelors'
      countries: {}, // { 'united-kingdom': { masters: {...}, bachelors: {...} } }
    };
  }

  /**
   * Save state to disk
   */
  saveState() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
      console.log("💾 State saved");
    } catch (error) {
      console.error("❌ Failed to save state:", error.message);
    }
  }

  /**
   * Get or create country state
   */
  getCountryState(countryLabel, portalType) {
    if (!this.state.countries[countryLabel]) {
      this.state.countries[countryLabel] = {
        masters: this.createPortalState(),
        bachelors: this.createPortalState(),
      };
    }

    if (!this.state.countries[countryLabel][portalType]) {
      this.state.countries[countryLabel][portalType] = this.createPortalState();
    }

    return this.state.countries[countryLabel][portalType];
  }

  /**
   * Create fresh portal state
   */
  createPortalState() {
    return {
      status: "not_started", // 'not_started', 'in_progress', 'completed', 'error'
      currentPage: 1,
      totalPagesDiscovered: 0,
      studyUrlsQueue: [], // URLs we still need to scrape
      scrapedStudyUrls: [], // URLs we've already scraped
      programsExtracted: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
    };
  }

  /**
   * Update country portal state
   */
  updateCountryState(countryLabel, portalType, updates) {
    const countryState = this.getCountryState(countryLabel, portalType);
    Object.assign(countryState, updates);
    this.saveState();
  }

  /**
   * Mark study URL as scraped
   */
  markStudyUrlScraped(countryLabel, portalType, url) {
    const countryState = this.getCountryState(countryLabel, portalType);

    // Remove from queue if present
    countryState.studyUrlsQueue = countryState.studyUrlsQueue.filter(
      (u) => u !== url
    );

    // Add to scraped list if not already there
    if (!countryState.scrapedStudyUrls.includes(url)) {
      countryState.scrapedStudyUrls.push(url);
    }

    this.saveState();
  }

  /**
   * Add study URLs to queue
   */
  addStudyUrlsToQueue(countryLabel, portalType, urls) {
    const countryState = this.getCountryState(countryLabel, portalType);

    // Only add URLs that haven't been scraped and aren't in queue
    const newUrls = urls.filter(
      (url) =>
        !countryState.scrapedStudyUrls.includes(url) &&
        !countryState.studyUrlsQueue.includes(url)
    );

    countryState.studyUrlsQueue.push(...newUrls);
    this.saveState();

    return newUrls.length;
  }

  /**
   * Get next study URL to scrape
   */
  getNextStudyUrl(countryLabel, portalType) {
    const countryState = this.getCountryState(countryLabel, portalType);
    return countryState.studyUrlsQueue[0] || null;
  }

  /**
   * Check if country/portal is completed
   */
  isCompleted(countryLabel, portalType) {
    const countryState = this.getCountryState(countryLabel, portalType);
    return countryState.status === "completed";
  }

  /**
   * Check if we should skip this country/portal
   */
  shouldSkip(countryLabel, portalType) {
    return this.isCompleted(countryLabel, portalType);
  }

  /**
   * Get current phase
   */
  getCurrentPhase() {
    return this.state.currentPhase;
  }

  /**
   * Set current phase
   */
  setCurrentPhase(phase) {
    this.state.currentPhase = phase;
    this.saveState();
  }

  /**
   * Reset state (start fresh)
   */
  reset() {
    this.state = this.createFreshState();
    this.saveState();
    console.log("🔄 State reset to fresh");
  }

  /**
   * Get progress summary
   */
  getProgressSummary() {
    const summary = {
      phase: this.state.currentPhase,
      countries: {},
    };

    for (const [country, data] of Object.entries(this.state.countries)) {
      summary.countries[country] = {
        masters: {
          status: data.masters.status,
          page: data.masters.currentPage,
          programsExtracted: data.masters.programsExtracted,
          queueSize: data.masters.studyUrlsQueue.length,
          scrapedCount: data.masters.scrapedStudyUrls.length,
        },
        bachelors: {
          status: data.bachelors.status,
          page: data.bachelors.currentPage,
          programsExtracted: data.bachelors.programsExtracted,
          queueSize: data.bachelors.studyUrlsQueue.length,
          scrapedCount: data.bachelors.scrapedStudyUrls.length,
        },
      };
    }

    return summary;
  }
}

export default StateManager;
