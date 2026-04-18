const { scrapeByType } = require('./_scraper.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const data = await scrapeByType('manga');

    const mapped = data.map(item => ({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      genre: item.genre || item.type,
      type: item.type,
    }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    res.json({
      status: true,
      total: mapped.length,
      data: mapped,
    });
  } catch (err) {
    console.error('Manga error:', err.message);
    res.status(500).json({ error: 'Failed to fetch manga list', message: err.message });
  }
};const