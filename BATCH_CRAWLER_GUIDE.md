# Batch Crawler with Resume Capability

## Overview

The batch crawler is designed for large-scale data extraction with the following features:

✅ **Batch Processing**: Processes all countries in order - Masters first, then Bachelors
✅ **Resume Capability**: Can continue from where it left off if interrupted
✅ **State Persistence**: Saves progress after every operation
✅ **Smart URL Extraction**: Scrolls search pages to extract all study URLs
✅ **Two-Phase Approach**: First extracts all URLs, then scrapes study pages
✅ **Error Recovery**: Continues even if individual pages fail

## Quick Start

```bash
# Start the batch crawler
npm run crawl:batch

# Check progress anytime (in another terminal)
npm run progress

# Reset and start fresh (if needed)
npm run reset
```

## How It Works

### Phase 1: Masters Portal (All Countries)

For each country in order, processes each search page completely before moving to the next:

**For Search Page 1:**
1. Visit `/search/master/united-kingdom?page=1`
2. Scroll to bottom to load all content
3. Extract all study URLs from this page
4. **Immediately scrape each study page**:
   - Extract full program details
   - Save to CSV: `output/masters-courses_united-kingdom.csv`
   - Mark URL as scraped
5. Move to search page 2

**For Search Page 2:**
- Repeat the same process
- Continue until no more search pages

**Why This Approach?**
- ✅ You get data immediately after each search page
- ✅ If crawler fails on page 50, you already have data from pages 1-49
- ✅ More resilient to failures
- ✅ Can stop and resume at any search page

### Phase 2: Bachelors Portal (All Countries)

Repeat the same process for Bachelors portal for all countries.

## State Management

### State File Location
`state/crawler-state.json`

### What's Saved

```json
{
  "lastUpdated": "2025-12-16T...",
  "currentPhase": "masters",
  "countries": {
    "united-kingdom": {
      "masters": {
        "status": "in_progress",
        "currentPage": 15,
        "studyUrlsQueue": ["url1", "url2", ...],
        "scrapedStudyUrls": ["url3", "url4", ...],
        "programsExtracted": 245,
        ...
      },
      "bachelors": { ... }
    }
  }
}
```

### State Statuses
- `not_started` - Haven't started this country/portal yet
- `in_progress` - Currently processing
- `completed` - Finished successfully
- `error` - Encountered fatal error

## Resume Capability

### How Resume Works

1. **Automatic Checkpoints**: State is saved after:
   - Each search page processed
   - Each study page scraped
   - Every 10 study pages (progress checkpoint)

2. **What Gets Resumed**:
   - Current country and portal
   - Current search page number
   - Remaining study URLs in queue
   - Already scraped URLs (won't re-scrape)

3. **How to Resume**:
   - Just run `npm run crawl:batch` again
   - It automatically detects where it left off
   - Continues from the exact page/URL

### Example Resume Scenarios

**Scenario 1: Stopped at Search Page 50**
```
❌ Ctrl+C during search page extraction
✅ Run: npm run crawl:batch
→ Resumes from search page 50
```

**Scenario 2: Stopped While Scraping Study Page 200**
```
❌ Computer crashed
✅ Run: npm run crawl:batch
→ Skips already scraped 199 URLs
→ Continues from URL #200
```

**Scenario 3: Completed UK, Stopped at USA**
```
❌ Stopped after UK completed
✅ Run: npm run crawl:batch
→ Skips UK (already completed)
→ Starts USA from page 1
```

## Commands

### Start/Resume Batch Crawl
```bash
npm run crawl:batch
```
- Starts fresh if no state exists
- Resumes from saved state if exists
- Processes in order: All Masters → All Bachelors

### Check Progress
```bash
npm run progress
```
Shows:
- Current phase (Masters or Bachelors)
- Status for each country/portal
- Current page numbers
- Programs extracted
- Queue sizes
- URLs scraped

Example output:
```
Country              Portal     Status          Page    Programs    Queue    Scraped
────────────────────────────────────────────────────────────────────────────────────
united-kingdom       Masters    completed       45      1203        0        1203
                     Bachelors  in_progress     12      345         156      345
united-states        Masters    not_started     1       0           0        0
                     Bachelors  not_started     1       0           0        0
```

### Reset State
```bash
npm run reset
```
- **WARNING**: Deletes all progress!
- Confirms before resetting
- Use when you want to start completely fresh

## Configuration

Edit [crawl-batch.js](crawl-batch.js):

```javascript
const crawler = new BatchCrawler({
  headless: true,              // Set to false to watch browser
  requestDelay: 3000,          // Delay between requests (ms)
  maxPagesPerCountry: 999,     // Max search pages per country
});
```

### Recommended Settings

**For Production (Large Scale)**
```javascript
{
  headless: true,
  requestDelay: 3000,
  maxPagesPerCountry: 999
}
```

**For Testing**
```javascript
{
  headless: false,
  requestDelay: 2000,
  maxPagesPerCountry: 5
}
```

**For Fast Crawling (Be Careful!)**
```javascript
{
  headless: true,
  requestDelay: 1500,
  maxPagesPerCountry: 999
}
```

## Output Files

### CSV Files
Same format as before:
- `output/masters-courses_united-kingdom.csv`
- `output/bachelors-courses_united-kingdom.csv`
- etc.

### State File
- `state/crawler-state.json` - Tracks progress

## Best Practices

### 1. Monitor Progress Regularly
```bash
# In one terminal
npm run crawl:batch

# In another terminal
watch -n 60 npm run progress  # Update every 60 seconds
```

### 2. Let It Run
- Designed to run for hours/days
- Don't interrupt unless necessary
- It will resume automatically if interrupted

### 3. Check CSV Files Periodically
```bash
# See how many programs extracted
wc -l output/*.csv

# View latest programs
tail output/masters-courses_united-kingdom.csv
```

### 4. Handle Errors Gracefully
- Individual page failures won't stop the crawler
- Check `state/crawler-state.json` for `lastError` fields
- Re-run to retry if needed

### 5. Backup State File
```bash
# Before making changes
cp state/crawler-state.json state/backup-$(date +%Y%m%d-%H%M%S).json
```

## Troubleshooting

### Issue: "Already completed, skipping..."
**Meaning**: This country/portal was finished in a previous run

**Solutions**:
- Check CSV file to verify data was extracted
- Use `npm run reset` if you want to re-crawl
- Or manually edit `state/crawler-state.json` to change status from "completed" to "not_started"

### Issue: Stuck on Same Page
**Symptoms**: Progress shows same page number repeatedly

**Debug**:
1. Check if search page has results: `npm run crawl:batch` with `headless: false`
2. Look for pagination issues
3. Check state file: might have large queue still processing

**Solution**:
```bash
# Check queue size
npm run progress

# If queue is being processed, just wait
# If stuck, you may need to skip this country manually
```

### Issue: Many Study Page Errors
**Symptoms**: Progress shows many errors in logs

**Common Causes**:
- Network issues
- Rate limiting
- Invalid URLs in queue

**Solutions**:
- Increase `requestDelay` to 5000ms
- Check if site is accessible
- Errors are logged but crawl continues

### Issue: Want to Skip a Country
**Solution**: Manually edit `state/crawler-state.json`:

```json
{
  "countries": {
    "problematic-country": {
      "masters": {
        "status": "completed"  // ← Change to "completed"
      }
    }
  }
}
```

Then restart crawler - it will skip that country.

## Advanced Usage

### Resume from Specific Page

Edit `state/crawler-state.json`:

```json
{
  "countries": {
    "united-kingdom": {
      "masters": {
        "status": "in_progress",
        "currentPage": 100,  // ← Start from page 100
        "studyUrlsQueue": [], // ← Clear queue if you want to re-extract
        "scrapedStudyUrls": []
      }
    }
  }
}
```

### Process Only Specific Portal

Edit `crawl-batch.js`:

```javascript
// Skip Masters phase
this.stateManager.setCurrentPhase("bachelors");

// Or comment out one phase in the crawl() method
```

### Extract Only, Don't Scrape

Modify `processCountryPortal()` in `crawl-batch.js`:

```javascript
// Comment out PHASE 2
// console.log("\n📚 PHASE 2: Scraping study pages");
// ... (comment out the whole while loop)
```

This will only extract URLs to the queue without scraping.

## Performance Metrics

Expected performance:
- **Search pages**: ~5-10 seconds per page
- **Study pages**: ~5-8 seconds per page
- **1000 programs**: ~2-3 hours
- **Full country (5000 programs)**: ~10-15 hours
- **All 6 countries**: ~3-5 days (depending on program counts)

## Monitoring Long Runs

### Using screen/tmux (Linux/Mac)

```bash
# Start in a screen session
screen -S crawler
npm run crawl:batch

# Detach: Ctrl+A, then D
# Reattach: screen -r crawler
```

### Using nohup

```bash
nohup npm run crawl:batch > crawler.log 2>&1 &

# Check logs
tail -f crawler.log
```

### Systemd Service (Linux)

Create `/etc/systemd/system/crawler.service`:

```ini
[Unit]
Description=Education Portal Crawler

[Service]
Type=simple
WorkingDirectory=/path/to/master_portal_crawler
ExecStart=/usr/bin/npm run crawl:batch
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl start crawler
sudo systemctl status crawler
sudo journalctl -u crawler -f
```

## Data Integrity

### Verify No Duplicates

```bash
# Check for duplicate URLs in CSV
cut -d',' -f12 output/masters-courses_united-kingdom.csv | sort | uniq -d
```

### Verify Completeness

Compare queue size to scraped count:
```bash
npm run progress
```

If `Queue: 0` and `Scraped: 1200`, all URLs were processed.

## Summary

The batch crawler is your tool for **large-scale, reliable data extraction**:

1. ✅ Start: `npm run crawl:batch`
2. ✅ Monitor: `npm run progress`
3. ✅ Interrupt anytime: Ctrl+C
4. ✅ Resume anytime: `npm run crawl:batch`
5. ✅ Reset if needed: `npm run reset`

**It just works.** Set it and forget it.
