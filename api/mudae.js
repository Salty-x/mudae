export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { name, series } = req.query;
    if (!name) return res.status(400).json({ error: 'No character name provided' });

    // mudae.net uses underscores in URLs, not %20
    const nameForUrl = name.trim().replace(/\s+/g, '_');

    try {
        const searchUrl = `https://mudae.net/search?type=character&name=${encodeURIComponent(name.trim())}`;
        const searchRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        const html = await searchRes.text();

        // Try to find character ID — if series provided, match it; otherwise take first result
        let charId = null;
        const idRegex = /\/character\/(\d+)\//;

        if (series) {
            const rows = html.split('<tr');
            for (const row of rows) {
                if (row.toLowerCase().includes(series.toLowerCase())) {
                    const idMatch = row.match(idRegex);
                    if (idMatch) { charId = idMatch[1]; break; }
                }
            }
        }

        // Fallback: first result
        if (!charId) {
            const idMatch = html.match(idRegex);
            if (!idMatch) return res.status(404).json({ error: 'Character not found', htmlSnippet: html.slice(0, 500) });
            charId = idMatch[1];
        }

        // Try underscore URL first, then %20, then bare name
        const urlVariants = [
            `https://mudae.net/character/${charId}/${nameForUrl}`,
            `https://mudae.net/character/${charId}/${encodeURIComponent(name.trim())}`,
            `https://mudae.net/character/${charId}/`,
        ];

        let charHtml = null;
        for (const charUrl of urlVariants) {
            const charRes = await fetch(charUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://mudae.net/'
                }
            });
            const text = await charRes.text();
            // Check if we actually got a character page (has an image upload)
            if (text.includes('mudae.net/uploads/')) {
                charHtml = text;
                break;
            }
        }

        if (!charHtml) return res.status(404).json({ error: 'Character page not found' });

        // Extract image URL
        const imgMatch = charHtml.match(/https:\/\/mudae\.net\/uploads\/[^"']+\.(?:png|jpg|jpeg|gif|webp)/i);
        if (!imgMatch) return res.status(404).json({ error: 'Image not found' });

        // Fetch the image and pipe it back to avoid CORS issues
        const imgRes = await fetch(imgMatch[0], {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://mudae.net/'
            }
        });

        if (!imgRes.ok) return res.status(404).json({ error: 'Image fetch failed' });

        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get('content-type') || 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(Buffer.from(imgBuffer));

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
