export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { name, series } = req.query;
    if (!name) return res.status(400).json({ error: 'No character name provided' });

    try {
        const searchUrl = `https://mudae.net/search?type=character&name=${encodeURIComponent(name)}`;
        const searchRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = await searchRes.text();

        // Try to find character ID — if series provided, match it; otherwise take first result
        let charId = null;
        if (series) {
            // Find all character rows and match by series
            const rowRegex = /\/character\/(\d+)\/[^"]+[^>]*>[\s\S]*?<\/tr>/gi;
            const idRegex = /\/character\/(\d+)\//;
            const rows = html.split('<tr');
            for (const row of rows) {
                if (row.toLowerCase().includes(series.toLowerCase())) {
                    const idMatch = row.match(idRegex);
                    if (idMatch) { charId = idMatch[1]; break; }
                }
            }
        }

        // Fallback to first result
        if (!charId) {
            const idMatch = html.match(/\/character\/(\d+)\//);
            if (!idMatch) return res.status(404).json({ error: 'Character not found' });
            charId = idMatch[1];
        }

        const charUrl = `https://mudae.net/character/${charId}/${encodeURIComponent(name)}`;
        const charRes = await fetch(charUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const charHtml = await charRes.text();

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

        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get('content-type') || 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(Buffer.from(imgBuffer));

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
