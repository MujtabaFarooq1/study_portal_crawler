export async function setOfflineCurrency(page, currency) {
  await page.addInitScript(
    ({ currency }) => {
      const key = "AnonymousStudent/Offline";

      const TEN_YEARS_IN_MS = 10 * 365 * 24 * 60 * 60 * 1000;
      const expires = Date.now() + TEN_YEARS_IN_MS;

      const existing = localStorage.getItem(key);
      let data = {};

      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          data = parsed.data ? JSON.parse(parsed.data) : {};
        } catch {
          data = {};
        }
      }

      const payload = {
        expires,
        data: JSON.stringify({
          ...data,
          currency,
        }),
      };

      localStorage.setItem(key, JSON.stringify(payload));
    },
    { currency }
  );
}
