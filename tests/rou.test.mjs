import test from 'node:test';
import assert from 'node:assert/strict';
import {SpiderHost} from '../../CrawlerBot/xptv/runtime-node/src/spider-host.js';
const source=new URL('../js/rou.js',import.meta.url).pathname;
const card='<a href="/v/fixture" class="group"><div class="relative"><img src="/cover.jpg" alt="Fixture"><span>720P</span></div><h3>Fixture</h3></a>';
const listing=`<div class="grid grid-cols-4">${card}${card}</div><nav><a href="?page=1">1</a><a href="?page=78">78</a></nav>`;
async function host(t,html){const calls=[];const h=new SpiderHost({fetchImpl:async url=>{calls.push(url);return new Response(html);}});await h.loadFromPath(source);t.after(()=>h.close());return {h,calls};}
test('new layout returns unique cards, absolute URLs and reported total pages for browse and search',async t=>{
 const {h,calls}=await host(t,listing);
 const cards=await h.call('getCards',{url:'https://rou.video/t/OnlyFans',page:2});
 assert.equal(cards.list.length,1);assert.equal(cards.list[0].vod_name,'Fixture');assert.equal(cards.list[0].vod_pic,'https://rou.video/cover.jpg');assert.equal(cards.pagecount,78);
 assert.match(calls[0],/page=2/);
 const search=await h.call('search',{text:'hello world',page:3});assert.equal(search.list.length,1);assert.equal(search.pagecount,78);assert.match(calls[1],/q=hello%20world/);
});
function ev(url){const k=5,d=Buffer.from(JSON.stringify({videoUrl:url}).split('').map(c=>String.fromCharCode(c.charCodeAt(0)+k)).join(''),'binary').toString('base64');return {d,k};}
test('new streamed detail decodes data without executing page JavaScript and declares HLS',async t=>{
 const e=ev('/api/hls/fixture');const {h}=await host(t,`<script>throw Error('never execute');ev:$R[96]={d:"${e.d}",k:${e.k}}</script>`);
 const tracks=await h.call('getTracks',{url:'https://rou.video/v/fixture'});const ext=tracks.list[0].tracks[0].ext;
 assert.equal(ext.url,'https://rou.video/api/hls/fixture');const play=await h.call('getPlayinfo',ext);assert.equal(play.type,'hls');assert.equal(play.urls[0],ext.url);
});
test('legacy Next detail and jpg playlist URL remain supported',async t=>{
 const {h}=await host(t,`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{ev:ev('https://media.example/a.jpg?token=x')}}})}</script>`);
 const tracks=await h.call('getTracks',{url:'https://rou.video/v/fixture'});const play=await h.call('getPlayinfo',tracks.list[0].tracks[0].ext);assert.equal(play.urls[0],'https://media.example/a.m3u8?token=x');
});
test('missing detail state reports a source error',async t=>{const {h}=await host(t,'<html>changed</html>');await assert.rejects(h.call('getTracks',{url:'https://rou.video/v/fixture'}));});
