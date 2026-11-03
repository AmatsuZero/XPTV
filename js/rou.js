const cheerio = createCheerio()

//来自群友“tou tie”

// 设置User Agent，模拟iPhone浏览器
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'

let appConfig = {
    ver: 20261103,
    title: '肉视频',
    site: 'https://rou.video',
    tabs: [
        {
            name: '國產AV',
            ui: 1,
            ext: {
                url: 'https://rou.video/t/國產AV',
            },
        },
        {
            name: '探花',
            ui: 1,
            ext: {
                url: 'https://rou.video/t/探花',
            },
        },
        {
            name: '自拍流出',
            ui: 1,
            ext: {
                url: 'https://rou.video/t/自拍流出',
            },
        },
        {
            name: 'OnlyFans',
            ui: 1,
            ext: {
                url: 'https://rou.video/t/OnlyFans',
            },
        },
        {
            name: '日本',
            ui: 1,
            ext: {
                url: 'https://rou.video/t/日本',
            },
        },
    ],
}

async function getConfig() {
    let config = appConfig
    return jsonify(config)
}

// Keep selectors tied to video links, not layout-only utility classes.
function parseCards(data) {
    const $ = cheerio.load(data)
    const cards = []
    const seen = new Set()
    $('a[href]').each((_, element) => {
        const link = $(element)
        const href = link.attr('href')
        if (!href || !/^\/v\/[^/?#]+(?:[?#].*)?$/.test(href) || !link.find('img').length) return
        if (seen.has(href)) return
        seen.add(href)
        const title = link.find('h3').text().trim() || link.find('img[alt]').last().attr('alt')
        const cover = link.find('img').last().attr('data-src') || link.find('img').last().attr('src')
        if (!title || !cover) return
        cards.push({vod_id: href, vod_name: title, vod_pic: new URL(cover, appConfig.site).href,
            vod_remarks: link.find('.relative span').map((_, el) => $(el).text()).get().join(' · '),
            ext: {url: new URL(href, appConfig.site).href}})
    })
    const pages = $('a[href*="page="]').map((_, el) => {
        const text = $(el).text().trim()
        return /^\d+$/.test(text) ? Number(text) : 0
    }).get()
    return {list: cards, ...(pages.length ? {pagecount: Math.max(...pages)} : {})}
}

async function getCards(ext) {
    ext = argsify(ext)
    const url = new URL(ext.url, appConfig.site)
    if (ext.page > 1) {
        url.searchParams.set('order', 'createdAt')
        url.searchParams.set('page', ext.page)
    }
    const {data} = await $fetch.get(url.href, {headers: {'User-Agent': UA}})
    return jsonify(parseCards(data))
}

async function getTracks(ext) {
    ext = argsify(ext)
    const {data} = await $fetch.get(ext.url, {headers: {'User-Agent': UA}})
    const $ = cheerio.load(data)
    let ev
    const legacy = $('#__NEXT_DATA__').html()
    if (legacy) ev = JSON.parse(legacy).props.pageProps.ev
    else {
        // Read only the encoded data literal; never execute source-page scripts.
        const match = data.match(/\bev\s*:\s*(?:\$R\[\d+\]\s*=\s*)?\{\s*d\s*:\s*"([A-Za-z0-9+/=]+)"\s*,\s*k\s*:\s*(\d+)\s*\}/)
        if (match) ev = {d: match[1], k: Number(match[2])}
    }
    if (!ev || typeof ev.d !== 'string' || !Number.isInteger(ev.k)) throw new Error('肉视频详情数据格式已变化：未找到播放数据')
    const decoded = JSON.parse(atob(ev.d).split('').map(c => String.fromCharCode(c.charCodeAt(0) - ev.k)).join(''))
    if (typeof decoded.videoUrl !== 'string' || !decoded.videoUrl) throw new Error('肉视频未返回播放地址')
    const playurl = new URL(decoded.videoUrl, appConfig.site).href
    return jsonify({list: [{title: '默认分组', tracks: [{name: '播放', pan: '', ext: {url: playurl}}]}]})
}

async function getPlayinfo(ext) {
    ext = argsify(ext)
    const playurl = ext.url.replace(/\.jpg(?=\?|$)/, '.m3u8')
    return jsonify({urls: [playurl], type: 'hls', headers: [{'User-Agent': UA, Referer: appConfig.site + '/'}]})
}

async function search(ext) {
    ext = argsify(ext)
    const url = `${appConfig.site}/search?q=${encodeURIComponent(ext.text)}&t=&page=${ext.page || 1}`
    const {data} = await $fetch.get(url, {headers: {'User-Agent': UA}})
    return jsonify(parseCards(data))
}
