# Subscription compatibility tests

These tests execute `js/rou.js` in CrawlerBot's SpiderHost, using synthetic HTML fixtures and no network.
Keep this fork next to a CrawlerBot checkout, then run:

```sh
node --test tests/rou.test.mjs
```

The fixture covers the current link-based card layout, reported pagination,
streamed detail data, legacy Next.js detail data, and extensionless HLS URLs.
Live media responses use PNG `roUd` transport and require a player or media proxy
that supports that transport; updating the source script alone does not decode it.
