import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

export const USAGE_TASK = 'plan-pace-usage';

if (Platform.OS !== 'web') TaskManager.defineTask(USAGE_TASK, async () => {
  try {
    const { runSync } = await import('./sync-runner');
    await runSync(true);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function ensureBackground(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const registered = await TaskManager.isTaskRegisteredAsync(USAGE_TASK);
    if (!registered) await BackgroundTask.registerTaskAsync(USAGE_TASK, { minimumInterval: 15 });
  } catch {
    // Opening the app still refreshes the numbers when background refresh is unavailable.
  }
}

export async function stopBackground(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(USAGE_TASK)) {
      await BackgroundTask.unregisterTaskAsync(USAGE_TASK);
    }
  } catch {
    // Signing out still deletes the login stored on the phone.
  }
}
