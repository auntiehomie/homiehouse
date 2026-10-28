# Notifications System

The HomieHouse notifications system provides real-time updates on user interactions including follows, likes, recasts, replies, and mentions, with detailed actor information.

## Features

### Notification Types

1. **Follows** 👤 - When someone follows you
2. **Likes** ❤️ - When someone likes your cast
3. **Recasts** 🔄 - When someone recasts your cast
4. **Replies** ↩️ - When someone replies to your cast
5. **Mentions** 💬 - When someone mentions you in a cast

### Actor Details

Each notification displays:
- **Profile Picture** - Avatar of the person who interacted
- **Display Name** - Full name or username
- **Power Badge** ⚡ - If they're a power user
- **Follower/Following Count** - Social stats
- **Quick Actions** - View profile or cast links

### Filtering & Organization

- **Filter by Type** - View all or specific notification types
- **Time-based Display** - Shows when the interaction occurred
- **Cast Previews** - See the content that was interacted with
- **Attachment Indicators** - Shows if casts have media

### Real-time Updates

- **Auto-refresh** - Polls for new notifications every 30 seconds
- **Unread Badge** - Red badge shows unread notification count
- **Manual Refresh** - Button to force refresh at any time

## User Interface

### Notification Card Layout

```
┌─────────────────────────────────────────────────┐
│ [Avatar]  Jane Doe ⚡ liked your cast           │
│   🔔      1,234 followers • 567 following        │
│                                                  │
│           ┌──────────────────────────────────┐  │
│           │ Your cast preview text here...   │  │
│           │ 📎 2 attachments                 │  │
│           └──────────────────────────────────┘  │
│                                                  │
│           2 hours ago                            │
│                                    View Profile  │
│                                    View Cast     │
└─────────────────────────────────────────────────┘
```

### Filter Tabs

- **All** - Shows all notification types
- **Likes** - Only like notifications
- **Recasts** - Only recast notifications
- **Replies** - Only reply notifications
- **Follows** - Only follow notifications
- **Mentions** - Only mention notifications

## Technical Implementation

### API Route

**Endpoint**: `/api/notifications`

```typescript
GET /api/notifications?fid=123&type=likes&cursor=xyz
```

**Parameters:**
- `fid` (required) - User's Farcaster ID
- `type` (optional) - Filter by notification type
- `cursor` (optional) - For pagination

**Response:**
```json
{
  "notifications": [
    {
      "type": "likes",
      "actor": {
        "fid": 456,
        "username": "janedoe",
        "display_name": "Jane Doe",
        "pfp_url": "https://...",
        "follower_count": 1234,
        "following_count": 567,
        "power_badge": true
      },
      "cast": {
        "hash": "0x...",
        "text": "Your cast content...",
        "author": {...},
        "embeds": [...]
      },
      "timestamp": "2026-01-22T10:30:00Z"
    }
  ],
  "next_cursor": "abc123",
  "has_more": true
}
```

### Components

#### NotificationBadge Component

Located: `src/components/NotificationBadge.tsx`

Features:
- Polls for unread count every 60 seconds
- Tracks last viewed timestamp in localStorage
- Shows red badge with count (9+ for 10 or more)
- Resets count when notifications are viewed

#### Notifications Page

Located: `src/app/notifications/page.tsx`

Features:
- Fetches and displays notifications
- Filter tabs for different types
- Auto-refresh every 30 seconds
- Actor information with social stats
- Cast previews for context
- Quick action links

### Data Flow

```
User Opens Notifications Page
        ↓
Fetch from /api/notifications
        ↓
Get FID from localStorage (hh_profile)
        ↓
Call Farcaster API API with FID
        ↓
Transform notifications data
        ↓
Display with actor details
        ↓
Auto-refresh every 30 seconds
```

### Unread Tracking

```
1. Store last viewed timestamp
   localStorage.setItem('hh_last_notif_view', timestamp)

2. Compare notification timestamps
   notifTime > lastViewedTime = unread

3. Count unread notifications
   Show badge with count

4. Mark as read when viewing
   Update timestamp on click
```

## Usage

### Viewing Notifications

1. Click the 🔔 icon in the bottom navigation
2. See all your recent notifications
3. Click filter tabs to narrow by type
4. Click "View Profile" to see who interacted
5. Click "View Cast" to see the content

### Understanding the Interface

**Notification Icons:**
- ❤️ = Someone liked your cast
- 🔄 = Someone recasted your cast
- 👤 = Someone followed you
- ↩️ = Someone replied to you
- 💬 = Someone mentioned you

**Actor Badges:**
- ⚡ = Power user badge
- Number displays = Follower/following counts

### Filtering

1. **All** - Default view, shows everything
2. Click specific filter to see only that type
3. Empty state shows friendly message
4. "View all notifications" button to reset filter

## Setup Requirements

### Environment Variables

Already configured in your `.env`:
```
FARCASTER_API_KEY=your_farcaster-api_api_key_here
```

### Dependencies

- `date-fns` - For timestamp formatting
- Farcaster API API - For fetching notifications
- Next.js API routes - For proxying requests

## Best Practices

### Performance

1. **Auto-refresh** - Set to 30 seconds to balance freshness and API usage
2. **Silent updates** - Background refreshes don't show loading state
3. **Cursor pagination** - Load more notifications as needed
4. **Local caching** - Store last viewed timestamp locally

### User Experience

1. **Unread badges** - Clear visual indicator of new activity
2. **Filter persistence** - Users can focus on specific types
3. **Actor details** - Full context about who interacted
4. **Quick actions** - Easy navigation to profiles and casts
5. **Time display** - Relative timestamps (e.g., "2 hours ago")

## Troubleshooting

### No Notifications Showing

**Possible causes:**
- Not signed in with Privy
- FID not found in localStorage
- Farcaster API API key issue
- No recent interactions

**Solutions:**
1. Verify you're signed in
2. Check console for errors
3. Click "Refresh" button
4. Check Farcaster API API key in `.env`

### Unread Badge Not Updating

**Possible causes:**
- Last viewed timestamp not saved
- localStorage cleared
- Auto-refresh not working

**Solutions:**
1. Clear localStorage and sign in again
2. Hard refresh page (Ctrl+Shift+R)
3. Check console for polling errors

### Actor Details Missing

**Possible causes:**
- Farcaster API API response structure changed
- User deleted their account
- API rate limiting

**Solutions:**
1. Check API response in browser DevTools
2. Graceful fallbacks display "Someone" as name
3. Default avatar shown if pfp_url missing

## Future Enhancements

Potential improvements:
- [ ] Push notifications (when available)
- [ ] Group similar notifications
- [ ] Mark individual notifications as read
- [ ] Notification settings/preferences
- [ ] Email digests
- [ ] Advanced filtering (date range, search)
- [ ] Notification sounds
- [ ] Desktop notifications
- [ ] Export notification history

## API Rate Limits

Farcaster API API considerations:
- Auto-refresh every 30 seconds
- Badge refresh every 60 seconds
- Consider implementing exponential backoff
- Cache responses when possible

## Accessibility

Features:
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- High contrast badge for visibility
- Relative timestamps for clarity

## Mobile Optimization

- Touch-friendly tap targets
- Responsive layout
- Sticky header for easy navigation
- Bottom padding for navigation bar
- Horizontal scroll for filter tabs
