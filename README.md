# Dungeon-X Cloudflare Worker - Notion Sync

A Cloudflare Worker that syncs turn-resolved events to Notion via REST API, with built-in rate-limit handling using KV storage.

## Features

- **`/turn-resolved` Endpoint**: POST endpoint to receive turn data
- **Notion Integration**: Writes data to Notion database via REST API
- **Rate Limit Handling**: Automatically queues requests in Cloudflare KV when Notion rate limits
- **Automatic Retry**: Processes queued items when rate limits clear
- **Error Handling**: Comprehensive error handling and logging

## Prerequisites

- Cloudflare account
- Notion integration and database
- Node.js 16+ installed
- Wrangler CLI (`npm install -g wrangler`)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name and select your workspace
4. Copy the "Internal Integration Token"

### 3. Create Notion Database

1. Create a new database in Notion
2. Add the following properties:
   - `Name` (Title) - Required
   - `Status` (Select) - Optional
   - `Description` (Text) - Optional
   - `Timestamp` (Date) - Optional
3. Share the database with your integration
4. Copy the database ID from the URL: `https://notion.so/YOUR_DATABASE_ID?v=...`

### 4. Create KV Namespace

```bash
# Create KV namespace for development
wrangler kv:namespace create "QUEUE_KV"

# Create KV namespace for production
wrangler kv:namespace create "QUEUE_KV" --preview false
```

Update `wrangler.toml` with the KV namespace ID returned.

### 5. Configure Secrets

```bash
# Set Notion API key
wrangler secret put NOTION_API_KEY

# Set Notion database ID
wrangler secret put NOTION_DATABASE_ID
```

## Development

Run the worker locally:

```bash
npm run dev
```

Test the endpoint:

```bash
curl -X POST http://localhost:8787/turn-resolved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Turn",
    "status": "Completed",
    "description": "This is a test turn"
  }'
```

## Deployment

Deploy to Cloudflare:

```bash
npm run deploy
```

## API Usage

### POST /turn-resolved

Accepts turn data and syncs it to Notion.

**Request:**

```json
{
  "name": "Turn 42",
  "status": "Completed",
  "description": "Player completed dungeon level 5"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Turn data synced to Notion"
}
```

**Response (Rate Limited - Queued):**

```json
{
  "success": true,
  "message": "Turn data queued due to rate limiting",
  "queued": true
}
```

**Response (Error):**

```json
{
  "error": "Error message"
}
```

## Configuration

### Environment Variables

Set via `wrangler secret put`:

- `NOTION_API_KEY`: Your Notion integration token
- `NOTION_DATABASE_ID`: Target Notion database ID

### KV Namespace

Configure in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "QUEUE_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

## Rate Limiting

When Notion returns a 429 (rate limit) response:

1. The request is queued in Cloudflare KV
2. A background process attempts to retry queued items
3. Items are retried up to 5 times before being dropped
4. Queued items expire after 24 hours

## Project Structure

```
.
├── src/
│   └── index.js          # Main worker code
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## License

MIT