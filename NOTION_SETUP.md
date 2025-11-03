# Notion Database Setup Guide

## Creating the Database

1. Open Notion and create a new page
2. Add a database (can be inline or full-page)
3. Name it something like "Dungeon X Turns"

## Required Properties

Configure your database with these properties:

### 1. Name (Title)
- **Type**: Title
- **Required**: Yes
- This will store the turn name/identifier

### 2. Status (Select) - Optional
- **Type**: Select
- **Options**: 
  - Pending
  - In Progress
  - Completed
  - Failed
  - Cancelled

### 3. Description (Text) - Optional
- **Type**: Text
- Used for detailed turn information

### 4. Timestamp (Date) - Optional
- **Type**: Date
- Automatically populated with creation time

## Additional Optional Properties

You can add these for enhanced tracking:

### Player ID
- **Type**: Text
- Store player identifier

### Turn Number
- **Type**: Number
- Sequential turn counter

### XP Gained
- **Type**: Number
- Experience points earned

### Items Found
- **Type**: Multi-select
- List of items discovered

### Location
- **Type**: Text
- Where the turn took place

## Sharing the Database

1. Click "Share" in the top right of your database
2. Click "Invite"
3. Select your integration from the list
4. Click "Invite"

Your integration now has access to read and write to this database.

## Getting the Database ID

The database ID is in the URL:

```
https://www.notion.so/YOUR_WORKSPACE/DATABASE_ID?v=VIEW_ID
                                      ^^^^^^^^^^^
```

Copy just the DATABASE_ID portion (between the last `/` and the `?`).

Example:
```
https://www.notion.so/myworkspace/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6?v=...
```
Database ID: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Testing the Setup

After configuring your worker with the integration token and database ID, test with:

```bash
curl -X POST http://localhost:8787/turn-resolved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Turn",
    "status": "Completed",
    "description": "Testing Notion integration"
  }'
```

Check your Notion database - you should see a new entry!
