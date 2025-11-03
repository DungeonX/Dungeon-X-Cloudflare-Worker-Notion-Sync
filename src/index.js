/**
 * Cloudflare Worker for syncing turn data to Notion
 * Exposes /turn-resolved endpoint and handles rate limiting with KV storage
 */

/**
 * Main worker request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle /turn-resolved endpoint
    if (url.pathname === '/turn-resolved' && request.method === 'POST') {
      return handleTurnResolved(request, env, ctx);
    }

    // Return 404 for other paths
    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Handle the /turn-resolved endpoint
 * Accepts POST requests with turn data and syncs to Notion
 */
async function handleTurnResolved(request, env, ctx) {
  try {
    // Parse request body
    const turnData = await request.json();

    // Validate required fields
    if (!turnData || typeof turnData !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try to write to Notion
    const result = await writeToNotion(turnData, env);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: 'Turn data synced to Notion' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (result.rateLimited) {
      // If rate limited, queue the request in KV
      await queueInKV(turnData, env);

      // Schedule retry processing
      ctx.waitUntil(processQueue(env));

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Turn data queued due to rate limiting',
          queued: true,
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(result.error || 'Failed to write to Notion');
    }
  } catch (error) {
    console.error('Error handling turn-resolved:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Write turn data to Notion database
 */
async function writeToNotion(turnData, env) {
  try {
    const notionApiKey = env.NOTION_API_KEY;
    const notionDatabaseId = env.NOTION_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      throw new Error('Notion API credentials not configured');
    }

    // Prepare Notion page properties
    const properties = {
      // Title property (required in most Notion databases)
      Name: {
        title: [
          {
            text: {
              content: turnData.name || `Turn ${Date.now()}`,
            },
          },
        ],
      },
    };

    // Add other properties from turnData
    if (turnData.status) {
      properties.Status = {
        select: {
          name: turnData.status,
        },
      };
    }

    if (turnData.description) {
      properties.Description = {
        rich_text: [
          {
            text: {
              content: turnData.description,
            },
          },
        ],
      };
    }

    // Add timestamp
    properties.Timestamp = {
      date: {
        start: new Date().toISOString(),
      },
    };

    // Create Notion page
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: {
          database_id: notionDatabaseId,
        },
        properties: properties,
      }),
    });

    // Check for rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`Rate limited by Notion. Retry after: ${retryAfter}`);
      return { success: false, rateLimited: true, retryAfter };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', response.status, errorText);
      return { success: false, error: `Notion API error: ${response.status}` };
    }

    const result = await response.json();
    console.log('Successfully created Notion page:', result.id);
    return { success: true, pageId: result.id };
  } catch (error) {
    console.error('Error writing to Notion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue turn data in KV storage when rate limited
 */
async function queueInKV(turnData, env) {
  if (!env.QUEUE_KV) {
    console.warn('KV namespace not configured, skipping queue');
    return;
  }

  try {
    const queueKey = `queue:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    await env.QUEUE_KV.put(
      queueKey,
      JSON.stringify({
        data: turnData,
        timestamp: Date.now(),
        retries: 0,
      }),
      {
        expirationTtl: 86400, // 24 hours
      }
    );
    console.log(`Queued turn data in KV: ${queueKey}`);
  } catch (error) {
    console.error('Error queuing in KV:', error);
  }
}

/**
 * Process queued items from KV storage
 */
async function processQueue(env) {
  if (!env.QUEUE_KV) {
    return;
  }

  try {
    // List all queued items
    const list = await env.QUEUE_KV.list({ prefix: 'queue:' });

    for (const key of list.keys) {
      try {
        const item = await env.QUEUE_KV.get(key.name, { type: 'json' });
        if (!item) continue;

        // Try to write to Notion
        const result = await writeToNotion(item.data, env);

        if (result.success) {
          // Remove from queue on success
          await env.QUEUE_KV.delete(key.name);
          console.log(`Successfully processed queued item: ${key.name}`);
        } else if (result.rateLimited) {
          // Still rate limited, update retry count
          item.retries = (item.retries || 0) + 1;
          if (item.retries < 5) {
            await env.QUEUE_KV.put(key.name, JSON.stringify(item), {
              expirationTtl: 86400,
            });
          } else {
            // Max retries reached, remove from queue
            await env.QUEUE_KV.delete(key.name);
            console.error(`Max retries reached for queued item: ${key.name}`);
          }
        } else {
          // Other error, increment retry count
          item.retries = (item.retries || 0) + 1;
          if (item.retries < 3) {
            await env.QUEUE_KV.put(key.name, JSON.stringify(item), {
              expirationTtl: 86400,
            });
          } else {
            await env.QUEUE_KV.delete(key.name);
            console.error(`Failed to process queued item after retries: ${key.name}`);
          }
        }
      } catch (error) {
        console.error(`Error processing queue item ${key.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing queue:', error);
  }
}
