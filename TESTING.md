# Example requests for testing the worker

## Successful turn-resolved request

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/turn-resolved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Turn 1 - Dragon Encounter",
    "status": "Completed",
    "description": "Player defeated the dragon and gained 100 XP"
  }'
```

## Minimal request

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/turn-resolved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Turn 2 - Treasure Found"
  }'
```

## Local testing (with wrangler dev)

```bash
# Start the worker locally
npm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:8787/turn-resolved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Turn",
    "status": "Testing",
    "description": "Local development test"
  }'
```

## Invalid request (should return 400)

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/turn-resolved \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

## Wrong endpoint (should return 404)

```bash
curl https://your-worker.your-subdomain.workers.dev/invalid-path
```

## Expected Responses

### Success (200):
```json
{
  "success": true,
  "message": "Turn data synced to Notion"
}
```

### Queued due to rate limiting (202):
```json
{
  "success": true,
  "message": "Turn data queued due to rate limiting",
  "queued": true
}
```

### Invalid request (400):
```json
{
  "error": "Invalid request body"
}
```

### Not found (404):
```
Not Found
```
