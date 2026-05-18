/**
 * /api/hint — AI Hint System
 * Player sends maze state, MiMo returns a directional hint
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json();
    const { grid, playerPos, exitPos, keysLeft, level } = body;

    if (!grid || !playerPos || !exitPos) {
      return new Response(JSON.stringify({ error: 'Missing maze data' }), { status: 400, headers });
    }

    // Build compact maze representation for AI
    const mazeStr = grid.map((row, y) =>
      row.map((cell, x) => {
        if (x === playerPos.x && y === playerPos.y) return 'P';
        if (x === exitPos.x && y === exitPos.y) return 'E';
        if (cell === 0) return '#'; // wall
        if (cell === 4) return 'K'; // key
        if (cell === 5) return 'T'; // trap
        if (cell === 6) return 'O'; // teleporter
        if (cell === 7) return 'X'; // enemy
        return '.'; // path
      }).join('')
    ).join('\n');

    const prompt = `You are a maze game hint assistant. The player is stuck in a maze.

Maze legend: P=player, E=exit, #=wall, .=path, K=key, T=trap(lose 5s), O=teleporter, X=enemy
Level: ${level}
Keys remaining to collect: ${keysLeft}

Maze:
${mazeStr}

Give a SHORT hint (max 2 sentences) about which direction to go next. Be helpful but don't give the full solution. If there are keys to collect, mention that. If there are traps nearby, warn them. Be encouraging and fun.`;

    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-pro',
        messages: [
          { role: 'system', content: 'You are MiMo, a fun and helpful maze game assistant. Keep responses short, playful, and useful. Max 2 sentences.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 150,
        temperature: 0.8,
        stream: false,
      }),
    });

    const data = await response.json();
    const hint = data.choices?.[0]?.message?.content || 'Try exploring a different path!';

    return new Response(JSON.stringify({ hint }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Hint generation failed', hint: 'Try going in a direction you haven\'t explored yet!' }), { status: 200, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
