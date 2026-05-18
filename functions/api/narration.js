/**
 * /api/narration — AI Tier Narration
 * When player enters a new tier, MiMo generates immersive story text
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json();
    const { tier, level, playerName } = body;

    if (!tier) {
      return new Response(JSON.stringify({ error: 'Missing tier data' }), { status: 400, headers });
    }

    const tierDescriptions = {
      'Rookie': 'The player just started. The maze is simple and welcoming.',
      'Apprentice': 'The player is getting better. Walls are taller, paths more winding.',
      'Thinker': 'The maze becomes a puzzle. Traps appear, and the AI guardian watches.',
      'Strategist': 'Memory matters now. Old tricks fail. The maze remembers.',
      'Infiltrator': 'Deception enters. False paths, lying clues, hidden dangers.',
      'Mastermind': 'The maze fights back. Rules change mid-run. Nothing is certain.',
      'Phantom': 'Reality bends. Multiple personalities guard the exit. Time is your enemy.',
      'Infinite': 'Beyond mortal limits. The maze generates itself endlessly. Only legends survive.',
    };

    const desc = tierDescriptions[tier] || 'A new challenge awaits.';

    const prompt = `You are a narrator for a dark, atmospheric maze game called "Hex Maze". The player "${playerName || 'Explorer'}" just reached Tier "${tier}" at Level ${level}.

Context: ${desc}

Write a SHORT atmospheric narration (2-3 sentences max) welcoming them to this new tier. Make it dramatic, mysterious, and exciting. Use second person ("You"). Don't use clichés. Be creative and slightly ominous.`;

    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: 'You are a dark fantasy narrator. Write atmospheric, concise game narrations. Max 3 sentences. No markdown formatting.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 150,
        temperature: 0.9,
        stream: false,
      }),
    });

    const data = await response.json();
    const narration = data.choices?.[0]?.message?.content || `Welcome to ${tier}. The maze grows deeper.`;

    return new Response(JSON.stringify({ narration, tier, level }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ narration: `You have entered ${tier || 'unknown territory'}. Tread carefully.`, tier, level: 0, debug: err.message }), { status: 200, headers });
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
