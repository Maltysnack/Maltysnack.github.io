# SideQuest — iOS Capability Map

## What's possible on iOS, and when

### PWA (installed from Safari, current stage)

| Feature | Possible in PWA? | Notes |
|---|---|---|
| Push notifications | ✅ Yes (iOS 16.4+) | Requires Service Worker + VAPID + push server. OneSignal makes this straightforward. NOT real-time — iOS can delay by minutes. |
| Offline use | ✅ Yes | Service Worker caches assets. Already partially works. |
| Home screen install | ✅ Yes | User adds from Safari share sheet. No App Store needed. |
| Local notifications (no server) | ⚠️ Limited | Can schedule notifications while app is open, not reliably when closed. |
| Set a native alarm | ❌ No | AlarmManager API doesn't exist on iOS for web apps. Hard limit from Apple. |
| Read HealthKit step count | ❌ No | Apple explicitly blocks HealthKit from web apps. No workaround. |
| Read sleep data | ❌ No | Same — HealthKit is native-only. |
| Read heart rate | ❌ No | Same. |
| Camera | ✅ Yes | getUserMedia() works in PWA on iOS. |
| Location | ✅ Yes | Geolocation API works. |
| Vibration / haptics | ⚠️ Partial | navigator.vibrate() blocked on iOS. No native haptic feedback. |
| Biometric auth (Face ID) | ✅ Yes | WebAuthn works on iOS in PWA context. |
| NFC | ❌ No | Web NFC not on iOS. |
| iCloud storage | ❌ No | LocalStorage only. 7-day wipe if app not opened. |
| App Store listing | ❌ No | PWA cannot be listed on App Store. |

---

### Native iOS app via Capacitor (Stage 3)

| Feature | Possible? | Notes |
|---|---|---|
| Set native alarms | ✅ Yes | UNNotificationRequest with UNCalendarNotificationTrigger. This is how "sleep at the inn" sets your wake-up alarm. |
| Read HealthKit step count | ✅ Yes | Capacitor Health plugin. Requires user permission. Shows daily step count in real time. |
| Read sleep data | ✅ Yes | HealthKit HKCategoryTypeIdentifierSleepAnalysis. Can verify "rest at the inn" was actually completed. |
| Read workout data | ✅ Yes | HealthKit workouts. "Train at the barracks" can auto-complete if you logged a workout. |
| Native haptic feedback | ✅ Yes | Capacitor Haptics plugin. Satisfying tap on quest complete. |
| Home screen widgets | ✅ Yes | WidgetKit via Capacitor plugin. Shows today's quest progress on home screen. This is very high value. |
| iCloud sync | ✅ Yes | Persistent storage, no 7-day wipe. |
| Apple Watch companion | ✅ Yes | Separate WatchOS target. One-tap quest complete from wrist. |
| Siri shortcuts | ✅ Yes | "Hey Siri, complete my training quest" |
| App Store listing | ✅ Yes | Requires Apple Developer account ($99/yr). |
| Background refresh | ✅ Yes | App can update quest state in background. |

---

## Honest implications for the roadmap

### "Sleep at the Inn sets an alarm"
This CANNOT work as a PWA. What you can do in PWA: send a push notification at 7:30am that says "Time to wake, adventurer." It's not an alarm — it won't override Do Not Disturb, it won't make the phone ring. It's a notification. That's the honest version.

The real alarm feature (locks to your sleep timer, overrides DnD, plays a custom sound) requires native. That's a Stage 3 feature and a genuine App Store differentiator.

### "Daily exercise reads step count"
Cannot do this in PWA. In native, this becomes one of the best features — the quest auto-completes when HealthKit confirms 8,000 steps. No manual ticking. This is a Stage 3 killer feature. Worth building natively for.

### "Push notifications"
This is Stage 2 and fully achievable in PWA. Highest priority after the UI fix. Without reminders, a habit tracker is passive and relies on the user remembering to open it. That kills retention.

Implementation path: OneSignal free tier → add Service Worker → scheduled daily notification at user-set time → streak at-risk notification.

---

## Priority recommendation

Build Stage 2 (push notifications) before worrying about HealthKit or alarms. The notification alone will meaningfully improve retention. Save the health integrations for the App Store launch — use them as the App Store pitch ("Your quests complete themselves when you actually do them").
