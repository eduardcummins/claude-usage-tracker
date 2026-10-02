import { Platform } from 'react-native';

type ResetWindow = {
  id: string;
  label: string;
  resetsAt: string | null;
};

export async function cancelResetAlarms(): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((item) => item.content.data?.kind === 'reset')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function notifyLocal(title: string, body: string): Promise<void> {
  const notifications = await prepareNotifications();
  if (!notifications) return;
  await notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function syncResetAlarms(windows: ResetWindow[]): Promise<number> {
  const notifications = await prepareNotifications();
  if (!notifications) return 0;
  const existing = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((item) => item.content.data?.kind === 'reset')
      .map((item) => notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  const now = Date.now();
  let scheduled = 0;
  for (const window of windows) {
    if (!window.resetsAt) continue;
    const when = Date.parse(window.resetsAt);
    if (!Number.isFinite(when) || when < now + 15000) continue;
    await notifications.scheduleNotificationAsync({
      content: {
        title: `${window.label} reset`,
        body: `Your ${window.label} limit resets now.`,
        data: { kind: 'reset', windowId: window.id },
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: 'resets',
      },
    });
    scheduled += 1;
  }
  return scheduled;
}

async function prepareNotifications() {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('resets', {
      name: 'Usage resets',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;
  return Notifications;
}
