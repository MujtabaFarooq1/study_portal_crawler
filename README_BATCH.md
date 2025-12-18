# Batch Crawler - Quick Reference

## 🚀 Start Crawling

```bash
npm run crawl:batch
```

This will:
- Process all countries in order
- Masters portal first (all countries)
- Then Bachelors portal (all countries)
- Save progress automatically
- Resume if interrupted

## 📊 Check Progress

```bash
npm run progress
```

Shows current status, page numbers, programs extracted, and queue sizes.

## 🔄 Reset Everything

```bash
npm run reset
```

Deletes all progress and starts fresh. **Use with caution!**

## Key Features

### ✅ Automatic Resume
- Stop anytime with Ctrl+C
- Run `npm run crawl:batch` again to continue
- Resumes from exact page/URL where it stopped

### ✅ Immediate Scraping

**For Each Search Page:**
1. Visit search page (e.g., page 1)
2. Scroll to bottom
3. Extract all study URLs from this page
4. **Immediately scrape each URL**:
   - Visit study page
   - Extract all details
   - Save to CSV
   - Mark as scraped
5. Move to next search page

**Why This Works Better:**
- ✅ Data saved immediately (don't lose everything if it crashes)
- ✅ Can see results after each search page
- ✅ Resume from exact search page where stopped
- ✅ More fault-tolerant

### ✅ State Persistence
- Saved after every operation
- Located at: `state/crawler-state.json`
- Tracks:
  - Current page number
  - URLs to scrape
  - URLs already scraped
  - Programs extracted

## Output

CSV files created:
- `output/masters-courses_united-kingdom.csv`
- `output/bachelors-courses_united-kingdom.csv`
- (one pair per country)

Each row includes `updatedAt` timestamp.

## Example Workflow

```bash
# 1. Start the crawler
npm run crawl:batch

# 2. Let it run... (can take hours/days)
# Computer crashes or you press Ctrl+C

# 3. Check what happened
npm run progress

# 4. Resume from where it stopped
npm run crawl:batch

# 5. Monitor in real-time (in another terminal)
watch -n 30 npm run progress
```

## When to Use

- **Large-scale scraping** (thousands of programs)
- **Multiple countries** (want all 6 countries)
- **Need reliability** (can't afford to restart)
- **Long-running** (overnight/multi-day crawls)

## Configuration

Edit `crawl-batch.js`:

```javascript
const crawler = new BatchCrawler({
  headless: true,           // false = see browser
  requestDelay: 3000,       // delay between requests (ms)
  maxPagesPerCountry: 999,  // max search pages
});
```

## Pro Tips

1. **Monitor in separate terminal**: `watch -n 60 npm run progress`
2. **Check CSV files**: `wc -l output/*.csv`
3. **Backup state**: `cp state/crawler-state.json state/backup.json`
4. **Use screen/tmux**: For long runs on servers
5. **Be patient**: Large crawls take time, but they're reliable

## Troubleshooting

**Q: How do I know if it's working?**
A: Run `npm run progress` - you should see increasing numbers

**Q: Can I stop and continue later?**
A: Yes! That's the whole point. Ctrl+C to stop, `npm run crawl:batch` to resume

**Q: What if it gets stuck?**
A: Ctrl+C and restart. It will skip already-scraped URLs

**Q: How do I start over?**
A: `npm run reset` (deletes all progress)

**Q: Where is my data?**
A: Check `output/` directory for CSV files

## See Also

- [BATCH_CRAWLER_GUIDE.md](BATCH_CRAWLER_GUIDE.md) - Detailed guide
- [MULTI_COUNTRY_CRAWLER.md](MULTI_COUNTRY_CRAWLER.md) - Original multi-country docs
- [QUICK_START_MULTI_COUNTRY.md](QUICK_START_MULTI_COUNTRY.md) - Quick start guide
