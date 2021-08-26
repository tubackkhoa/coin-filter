const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const puppeteer = require('puppeteer');

let page = null;
if (process.env.NODE_ENV === 'production') console.log = () => {};

app.get('/:name', async (req, res) => {
  const { name } = req.params;
  if (!name) {
    res.json({ error: 'Name is empty' });
  }
  const data = {
    name: name
      .replace(/-+/g, ' ')
      .replace(/(?<=^|\s)./g, (m) => m.toUpperCase())
  };
  if (!page) return res.end();
  await page.goto(`https://www.coingecko.com/en/coins/${name}`);

  const start = Date.now();

  try {
    data.CurrentPrice = await (
      await page.waitForSelector('span.tw-text-3xl')
    ).evaluate((el) => el.innerText.trim());

    Object.assign(
      data,
      Object.fromEntries(
        await page.$$eval('div.order-3 tr', (list) =>
          list.map((tr) => [
            tr.querySelector('th').innerText.trim().replace(/[ /-]/g, ''),
            tr.querySelector('td').innerText.trim()
          ])
        )
      )
    );

    Object.assign(
      data,
      Object.fromEntries(
        await page.$$eval('div.tw-flex-grow', (list) =>
          list.slice(0, 6).map((tr) => {
            const [td1, td2] = tr.innerText.trim().split(/\s(?=\$?\d)/);
            return [td1.replace(/[ /-]/g, ''), td2];
          })
        )
      )
    );

    console.log('take', Date.now() - start, 'ms');
    res.json(data);
  } catch (ex) {
    res.end(ex.message);
  }
});

app.listen(port, async () => {
  console.log(`App listening at port:${port}`);
  const args = process.env.PROXY ? [`--proxy-server=${process.env.PROXY}`] : [];
  const browser = await puppeteer.launch({ args });
  page = await browser.newPage();
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
