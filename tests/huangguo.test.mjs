import test from 'node:test';
import assert from 'node:assert/strict';
import {SpiderHost} from '../../CrawlerBot/xptv/runtime-node/src/spider-host.js';

const source = new URL('../js/huangguo.js', import.meta.url).pathname;
const media = 'https://cdn.example/episode.m3u8?auth_key=fixture&v=3';
const payload = () => ({status: 1, data: {
  id: '123', ep: 2, manifest_method: 'GET', streams: {main: media, hevc: ''},
  cdn: {m3u8Enabled: true, authKey: 'x-cdn-auth', authValue: 'fixture-auth', app: '150'},
}});

async function host(t, response = payload(), status = 200) {
  const calls = [];
  const h = new SpiderHost({fetchImpl: async (url, options) => {
    calls.push({url: String(url), options});
    return new Response(JSON.stringify(response), {status, headers: {'Content-Type': 'application/json'}});
  }});
  await h.loadFromPath(source);
  t.after(() => h.close());
  return {h, calls};
}

test('playback uses a fresh episode POST and carries CDN headers through SpiderHost', async t => {
  const {h, calls} = await host(t);
  const ext = {url: 'https://huangguoai.com/video/123/ep-2/', ep: '2'};
  const result = await h.call('getPlayinfo', ext);
  assert.equal(result.urls[0], media);
  assert.equal(result.headers[0]['x-cdn-auth'], 'fixture-auth');
  assert.equal(result.headers[0]['x-cdn-app'], '150');
  assert.equal(result.headers[0].Referer, 'https://huangguoai.com/');
  assert.equal(result.type, 'hls');
  await h.call('getPlayinfo', ext);
  assert.equal(calls.length, 2, 'signed URLs are never cached');
  assert.equal(calls[0].url, 'https://huangguoai.com/api/videos/123/episodes/2/playback');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {});
});

test('first-episode links and JSON-string arguments remain supported', async t => {
  const body = payload(); body.data.ep = 1;
  const {h, calls} = await host(t, body);
  assert.equal((await h.call('getPlayinfo', JSON.stringify({url: 'https://huangguoai.com/video/123/'}))).urls[0], media);
  assert.equal(calls[0].url, 'https://huangguoai.com/api/videos/123/episodes/1/playback');
});

for (const kind of ['http', 'denied', 'empty', 'identity', 'method']) {
  test(`playback reports ${kind} failures without returning stale media`, async t => {
    const body = payload();
    if (kind === 'denied') { body.status = 0; body.msg = '请登录后重试'; }
    if (kind === 'empty') body.data.streams.main = '';
    if (kind === 'identity') body.data.ep = 1;
    if (kind === 'method') body.data.manifest_method = 'POST';
    const {h} = await host(t, body, kind === 'http' ? 503 : 200);
    const result = await h.call('getPlayinfo', {url: 'https://huangguoai.com/video/123/ep-2/', ep: '2'});
    assert.equal(result.urls.length, 0);
    assert.ok(result.parse_error, 'failure has an actionable explanation');
  });
}

test('invalid episode links never issue playback requests', async t => {
  const {h, calls} = await host(t);
  const result = await h.call('getPlayinfo', {url: 'https://unrelated.example/video/123/', ep: '../2'});
  assert.equal(result.urls.length, 0);
  assert.ok(result.parse_error);
  assert.equal(calls.length, 0);
});

test('catalogue, episode extraction and encrypted poster transport stay compatible', async t => {
  const h = new SpiderHost({fetchImpl: async url => new Response(String(url).includes('/video/')
    ? '<a class="hg-web-play__ep" href="/video/123/ep-2/" data-ep-id="2">Episode</a>'
    : '<div class="hg-card-grid"><div class="hg-drama-card"><a class="hg-drama-card__title" href="/detail/123/">Fixture</a></div></div>')});
  await h.loadFromPath(source); t.after(() => h.close());
  const cards = await h.call('getCards', {id: 'home', page: 1});
  assert.equal(cards.list[0].vod_name, 'Fixture');
  const tracks = await h.call('getTracks', cards.list[0].ext);
  assert.equal(tracks.list[0].tracks[0].ext.ep, '2');
  const poster = new URL(await h.call('proxyPic', 'https://images.example/fixture'));
  assert.equal(poster.pathname, '/img');
  assert.equal(poster.searchParams.get('url'), 'https://images.example/fixture');
});
