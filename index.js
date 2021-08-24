const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const puppeteer = require('puppeteer');
const data = { Name: 'Oraichain Token' };
let running = true;

if (process.env.NODE_ENV === 'production') console.log = () => {};

const delay = (time) =>
  new Promise(function (resolve) {
    setTimeout(resolve, time);
  });

app.get('/', (req, res) => {
  res.json(data);
});

app.listen(port, async () => {
  console.log(`App listening at port:${port}`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);
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
  await page.goto('https://www.coingecko.com/en/coins/oraichain-token');

  while (running) {
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
            list
              .slice(0, 6)
              .map((tr) => tr.innerText.trim().split(/\s(?=\$?\d)/))
          )
        )
      );

      console.log(data, 'take', Date.now() - start, 'ms');
      await delay(5000);
      await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
    } catch (ex) {
      console.log(ex.message);
    }
  }

  await browser.close();
});

process.on('SIGINT', function () {
  running = false;
});
