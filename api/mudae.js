export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'No character name provided' });

    try {
        const searchUrl = `https://mudae.net/search?term=${encodeURIComponent(name)}`;
        const searchRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = await searchRes.text();

        // Extract first character link from search results
        const charLinkMatch = html.match(/href="(\/character\/\d+\/[^"]+)"/);
        if (!charLinkMatch) return res.status(404).json({ error: 'Character not found' });

        const charUrl = `https://mudae.net${charLinkMatch[1]}`;
        const charRes = await fetch(charUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const charHtml = await charRes.text();

        // Extract image URL
        const imgMatch = charHtml.match(/https:\/\/mudae\.net\/uploads\/[^"']+\.(?:png|jpg|jpeg|gif|webp)/i);
        if (!imgMatch) return res.status(404).json({ error: 'Image not found' });

        return res.status(200).json({ image: imgMatch[0], charUrl });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
