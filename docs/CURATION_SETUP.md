# Quick Setup: Feed Curation Feature

## Step-by-Step Setup

### 1. Run Database Migration

1. Open Supabase SQL Editor: https://afpxttdtxzdmaiyvnvjd.supabase.co
2. Copy and paste the SQL from `server/curation_migration.sql`
3. Click "Run" to create the table

### 2. Install Dependencies (if needed)

The curation feature uses existing dependencies, but if you haven't installed them yet:

```bash
# For the main app
npm install

# For the server
cd server
npm install
cd ..
```

### 3. Start the Server

The server needs to be running for curation to work:

```bash
cd server
npm run dev
```

The server should start on port 3001.

### 4. Start the Next.js App

In a separate terminal:

```bash
npm run dev
```

The app should start on port 3000.

### 5. Test the Feature

1. Open http://localhost:3000
2. Sign in with your Farcaster account
3. Click "Feed" tab
4. Click "⚙️ Curate" button
5. Add your first curation preference!

## Verifying It Works

### Test with a Keyword Filter

1. Click "⚙️ Curate"
2. Add preference:
   - Type: Keyword
   - Action: Include
   - Value: "crypto" (or any keyword you know appears in your feed)
   - Priority: 1
3. Click "Add Preference"
4. Close the modal
5. Refresh your feed - you should see crypto-related posts boosted to the top!

### Test with an Exclude Filter

1. Click "⚙️ Curate"
2. Add preference:
   - Type: Keyword
   - Action: Exclude
   - Value: "test"
3. Click "Add Preference"
4. Close the modal
5. Posts containing "test" should now be hidden

## Troubleshooting

### "Please sign in to manage curation preferences"
- Make sure you're logged in with Privy
- Check that your profile is saved in localStorage

### Preferences not loading
- Check browser console for errors
- Verify the server is running on port 3001
- Check Supabase connection

### Server errors
- Verify `.env` file in `server/` directory has:
  ```
  SUPABASE_URL=https://afpxttdtxzdmaiyvnvjd.supabase.co
  SUPABASE_KEY=your_key_here
  ```

### Feed not updating
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Check if preferences were saved (reopen the modal)

## What's Next?

Now you can:
- Add multiple preferences
- Mix include and exclude filters
- Set different priorities
- Experiment with different content types
- Curate your perfect feed!

See [CURATION_GUIDE.md](./CURATION_GUIDE.md) for detailed documentation.
