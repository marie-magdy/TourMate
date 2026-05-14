# Notification System Testing Guide

## Quick Test Method

### Option 1: Using Existing Itinerary Screen (Recommended)
1. Launch the app with `npx expo start`
2. Log in or sign up
3. Go to **Plan** → Select a city → Create a plan
4. The app will automatically start tracking the plan
5. Open **Developer Console** to see notification logs:
   - **Web**: Press `F12` and go to Console tab
   - **Mobile**: Use Expo Go app logs or connect to development server
6. Look for logs with `[PlanNotifications]` prefix

### Option 2: Using Test Utility
1. In your React component, import the test utility:
```tsx
import { startTestPlan } from '../../utils/testNotifications';

// Add a button to trigger the test
<TouchableOpacity onPress={() => startTestPlan()}>
  <Text>Test Notifications</Text>
</TouchableOpacity>
```

2. When you click the button, it creates a test plan with:
   - First activity ending in ~1 minute (notification triggers at ~1 minute mark)
   - Second activity ending in ~35 minutes (notification triggers at ~30 minute mark)
   - Third activity ending in ~60 minutes (notification triggers at ~55 minute mark)

## What to Look For

### Console Logs
You should see logs like:
```
[PlanNotifications] Starting to track plan: test-plan-1715513200000
[PlanNotifications] Plan start date: Tue May 12 2026 14:30:00...
[PlanNotifications] Activities: [{name: "🏛️ Museum Visit", time: "14:30", duration: 0.1}, ...]
[PlanNotifications] Scheduling all future notifications...
[PlanNotifications] Activity: 🏛️ Museum Visit, Start: 14.5h, End: 14.6h, Elapsed: 0h
[PlanNotifications] Scheduling notification for 🏛️ Museum Visit
[PlanNotifications] Scheduled notification for activity: 🏛️ Museum Visit at: Tue May 12 2026 14:35:00...
[PlanNotifications] Check cycle - Elapsed hours: 0.08
```

### Notification Delivery
- **Mobile (iOS/Android)**: Notification will appear in the notification center at the scheduled time
- **Web**: Notifications may have limited support depending on browser

## Expected Behavior

1. **Immediate** → Logs appear showing plan started
2. **Within 5 seconds** → First checkAndNotify cycle runs
3. **At notification time** → Notification sent with:
   - Title: "⏰ Get Ready!"
   - Body: "Your time at [Activity] is ending in 5 minutes.\nNext: [Next Activity]"

## Debugging Tips

### If Notifications Don't Appear:
1. **Check permissions**: App should request notification permission on startup
2. **Check time calculations**: Verify elapsed hours match activity times in console
3. **Check notification scheduling**: Look for "Scheduled notification" logs
4. **Try test utility**: Test with the simple test plan first

### Key Timestamps to Watch:
- `notificationHour`: When the notification should trigger (5 minutes before activity ends)
- `elapsedHours`: Current time relative to plan start
- Notification should trigger when `elapsedHours >= notificationHour`

## Mobile Device Testing

### iOS (using Expo Go)
1. Install Expo Go from App Store
2. Scan QR code from terminal
3. Allow notification permissions when prompted
4. Open app logs with Shift+Ctrl+I (Mac) or Shift+Ctrl+D (Android)

### Android (using Expo Go)
1. Install Expo Go from Google Play
2. Scan QR code from terminal
3. Allow POST_NOTIFICATIONS permission
4. View logs in Expo Go app

## Testing Timeline

| Time | Expected Action |
|------|---|
| 0:00 | Plan tracking starts |
| 0:05 | First notification scheduled for ~1 minute from now |
| 1:00 | **First notification should appear** |
| 5:00 | Second notification scheduled |
| 10:00 | Check cycles continue |
| 30:00 | **Second notification should appear** |
| 35:00 | Third notification scheduled |
| 60:00 | **Third notification should appear** |
