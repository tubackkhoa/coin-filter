const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const puppeteer = require('puppeteer');

const userAgent =
  process.env.AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36';
let page = null;
if (process.env.NODE_ENV === 'production') console.log = () => {};

app.get('/category/:category', async (req, res) => {
  const { category } = req.params;
  const { maxCap = 0 } = req.query;
  if (!category) {
    res.json({ error: 'category is empty' });
  }

  if (!page) return res.end();
  await page.goto(`https://www.coingecko.com/en/categories/${category}`);

  try {
    let data = await (
      await page.waitForSelector(
        'table[data-target="gecko-table.table portfolios-v2.table"]'
      )
    ).evaluate((table) => {
      const headers = [...table.querySelectorAll('thead th')]
        .map((th) => th.innerText.trim())
        .slice(1, -1);
      const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')]
          .map((td) => td.innerText.trim())
          .slice(1, -1)
      );
      const list = [];
      for (const row of rows) {
        const item = {};
        for (const i in row) {
          item[headers[i]] = row[i];
        }
        list.push(item);
      }
      return list;
    });

    if (maxCap) {
      data = data.filter((item) => {
        const marketCap = parseInt(item['Mkt Cap'].replace(/[$,]/g, ''));
        return marketCap < maxCap;
      });
    }

    res.json(data);
  } catch (ex) {
    console.log(ex.message);
    const buffer = await page.screenshot();
    res.end(buffer, 'binary');
  }
});

app.listen(port, async () => {
  console.log(`App listening at port:${port}`);
  const args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (process.env.PROXY) args.push(`--proxy-server=${process.env.PROXY}`);
  const browser = await puppeteer.launch({ args });
  page = await browser.newPage();
  await page.setUserAgent(userAgent);
  console.log('Page is ready');
  page.setRequestInterception(true);
  // ignore images,css,font
  page.on('request', (request) => {
    if (
      ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });
});

process.on('SIGINT', async () => {
  await browser.close();
});
