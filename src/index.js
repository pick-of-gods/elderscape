export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/api/export') {
      const form = await req.formData();
      const file = form.get('file');
      const modelId = form.get('modelId');
      const type = form.get('type');

      const base64 = type === 'png' ? Buffer.from(await file.arrayBuffer()).toString('base64') : null;

      let description = '';
      if (type === 'png') {
        const v = await env.AI.run('@cf/llama-3.2-11b-vision-instruct', {
          image: { base64 },
          prompt: `Describe RuneScape model ${modelId} in detail.`
        });
        description = v.response;
      }

      const wiki = await getWiki(modelId, env);
      const lore = await env.AI.run('@cf/llama-3.1-8b-instruct', {
        prompt: `Write RuneScape‑style lore for model ${modelId}: ${description}. Wiki info: ${wiki}`,
        max_tokens: 120
      });

      const data = { modelId, description, lore: lore.response, wiki, timestamp: Date.now() };
      await env.ELDERSCAPE_KV.put(`model:${modelId}`, JSON.stringify(data), { expirationTtl: 604800 });
      return Response.json(data);
    }
    return new Response('Not Found', { status: 404 });
  }
};

async function getWiki(id, env) {
  const cached = await env.ELDERSCAPE_KV.get(`wiki:${id}`);
  if (cached) return cached;
  const r = await fetch(`https://runescape.wiki/api.php?action=query&prop=extracts&format=json&titles=Model:${id}`);
  const j = await r.json();
  const extract = Object.values(j.query.pages)[0]?.extract || 'No info';
  await env.ELDERSCAPE_KV.put(`wiki:${id}`, extract);
  return extract;
}