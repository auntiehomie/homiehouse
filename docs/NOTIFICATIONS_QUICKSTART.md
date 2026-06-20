# HomieHouse Notifications - Quick Start

## What's New

✅ **Enhanced Notifications Page** with detailed actor information  
✅ **Filter Tabs** to view specific notification types  
✅ **Unread Badge** showing count of new notifications  
✅ **Auto-refresh** every 30 seconds for real-time updates  
✅ **Actor Details** including followers, following, and power badges  
✅ **Cast Previews** for context on what was interacted with  
✅ **Quick Actions** to view profiles and casts  

## How to Use

### 1. Access Notifications

Click the 🔔 bell icon in the bottom navigation bar.

### 2. View Notifications

Each notification shows:
- **Who**: Actor's name, avatar, and stats
- **What**: Type of interaction (like, recast, follow, reply, mention)
- **When**: Time since the interaction
- **Context**: Preview of the cast (if applicable)

### 3. Filter Notifications

Use the filter tabs at the top:
- **All** - See everything
- **Likes** - Only like notifications
- **Recasts** - Only recasts
- **Replies** - Only replies
- **Follows** - Only new followers
- **Mentions** - Only mentions

### 4. Take Action

Click quick links on each notification:
- **View Profile** - See the actor's profile
- **View Cast** - Go to the specific cast

### 5. Track Unread

The red badge on the bell icon shows unread count:
- Updates automatically every minute
- Resets when you open notifications
- Shows "9+" for 10 or more unread

## Features at a Glance

### Notification Types

| Icon | Type | Description |
|------|------|-------------|
| ❤️ | Likes | Someone liked your cast |
| 🔄 | Recasts | Someone recasted your cast |
| 👤 | Follows | Someone followed you |
| ↩️ | Replies | Someone replied to your cast |
| 💬 | Mentions | Someone mentioned you |

### Actor Information

Each notification displays:
- **Avatar** with type badge overlay
- **Display Name** with ⚡ power badge (if applicable)
- **Follower/Following counts**
- **Username** for identification

### Smart Features

1. **Auto-refresh** - New notifications appear automatically
2. **Manual refresh** - Click 🔄 button to force update
3. **Persistent filters** - Your selected filter stays active
4. **Cast context** - See what cast was interacted with
5. **Time formatting** - Human-readable timestamps

## Testing It Out

### 1. Check Your Notifications

```bash
# Start the app if not running
npm run dev
```

1. Open http://localhost:3000
2. Sign in if needed
3. Click the 🔔 bell icon
4. View your notifications!

### 2. Test Filtering

1. Click "Likes" to see only like notifications
2. Click "Follows" to see only new followers
3. Click "All" to return to full view

### 3. Test Unread Badge

1. Note the current badge count
2. Wait 30 seconds for auto-refresh
3. Watch for new notifications
4. Badge updates automatically

## Technical Details

### File Locations

```
src/
├── app/
│   ├── api/
│   │   └── notifications/
│   │       └── route.ts          ← API endpoint
│   └── notifications/
│       └── page.tsx              ← Main notifications page
└── components/
    ├── NotificationBadge.tsx     ← Unread count badge
    └── BottomNav.tsx             ← Navigation with badge
```

### Data Source

Notifications are fetched from the **Neynar API**:
- Real-time data from Farcaster network
- Includes actor details, cast info, timestamps
- Paginated for performance

### Local Storage Keys

```javascript
'hh_profile'           // Your FID and profile info
'hh_last_notif_view'  // Last viewed timestamp for unread tracking
```

## Customization Options

### Adjust Auto-refresh Rate

In `src/app/notifications/page.tsx`:
```typescript
// Currently 30 seconds
const interval = setInterval(() => {
  loadNotifications(true);
}, 30000); // Change this value
```

### Adjust Badge Update Rate

In `src/components/NotificationBadge.tsx`:
```typescript
// Currently 60 seconds
const interval = setInterval(() => {
  loadUnreadCount();
}, 60000); // Change this value
```

### Customize Filter Types

In `src/app/notifications/page.tsx`:
```typescript
type NotificationFilter = 'all' | 'likes' | 'recasts' | 'replies' | 'follows' | 'mentions';
```

Add more types as needed.

## Troubleshooting

### "No notifications yet"

**Normal behavior if:**
- You're a new user
- No recent interactions
- Filtered view has no matching notifications

**Try:**
- Switch to "All" filter
- Click refresh button
- Post some casts to generate activity

### Badge not showing

**Check:**
1. Are you signed in?
2. Is localStorage working?
3. Any console errors?

**Fix:**
- Hard refresh (Ctrl+Shift+R)
- Clear localStorage and re-login
- Check browser console for errors

### Notifications not loading

**Possible issues:**
- Network connectivity
- Neynar API key
- FID not found

**Solutions:**
1. Check `.env` for `NEYNAR_API_KEY`
2. Verify you're signed in
3. Check browser console
4. Click "Retry" button

## API Response Example

```json
{
  "notifications": [
    {
      "type": "likes",
      "actor": {
        "fid": 12345,
        "username": "janedoe",
        "display_name": "Jane Doe",
        "pfp_url": "https://...",
        "follower_count": 1234,
        "following_count": 567,
        "power_badge": true
      },
      "cast": {
        "hash": "0xabc...",
        "text": "Great post!",
        "embeds": []
      },
      "timestamp": "2026-01-22T10:30:00Z"
    }
  ],
  "next_cursor": "xyz123",
  "has_more": true
}
```

## Performance Tips

1. **Auto-refresh is throttled** - Won't spam API
2. **Silent updates** - No loading spinner for background refreshes
3. **Efficient filtering** - Done client-side after fetch
4. **Cursor pagination** - Only load what you need
5. **Cached timestamps** - Unread tracking is local

## Next Steps

1. ✅ **Test the feature** - Click around and explore
2. 📝 **Customize as needed** - Adjust refresh rates, filters
3. 🎨 **Style to match** - Update colors, spacing
4. 🚀 **Deploy** - Ready for production
5. 📊 **Monitor** - Watch for API rate limits

## Related Features

This notification system integrates with:
- **Feed curation** - See who's interacting with curated content
- **Profile system** - Quick links to actor profiles
- **Cast system** - Context for what was interacted with
- **Navigation** - Accessible from bottom nav

## Support

For issues or questions:
1. Check [NOTIFICATIONS_GUIDE.md](./NOTIFICATIONS_GUIDE.md) for detailed docs
2. Review browser console for errors
3. Verify environment variables
4. Test API endpoint directly: `/api/notifications?fid=YOUR_FID`

---

**Built with:** Next.js, React, TypeScript, Neynar API, date-fns

**Last updated:** January 22, 2026
