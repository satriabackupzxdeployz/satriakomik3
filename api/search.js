const { scrapeSearch } = require('./_scraper.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" required' });

  try {
    const results = await scrapeSearch(q);

    const mapped = results.map(item => ({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      genre: item.genre || item.type,
      type: item.type,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json(mapped);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Failed to search', message: err.message });
  }
};const