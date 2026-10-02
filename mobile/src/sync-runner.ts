import { cancelResetAlarms, notifyLocal, syncResetAlarms } from './alerts';
import { isValidTopic } from './model';
import type { Snapshot } from './model';
import { fetchLatestSnapshot, settingsFromInput } from './ntfy';
import { stopBackground } from './register-background';
import {
  WidgetCache,
  clearPlanData,
  emptyWidget,
  loadScheduled,
  loadSettings,
  loadSnapshot,
  loadWidgetCache,
  loadWindows,
  saveScheduled,
  saveSettings,
  saveSnapshot,
  saveWidgetCache,
  saveWindows,
} from './storage';
import { planAlarms, resetNotification } from './usage';
import { widgetFromSnapshot } from './widget-data';
import { pushWidget } from './widget-update';

export type SyncOutcome = {
  snapshot: Snapshot | null;
  error: string | null;
  connected: boolean;
  waiting: boolean;
  widget: WidgetCache;
};

let inflight: Promise<SyncOutcome> | null = null;

export function runSync(updateWidget = true): Promise<SyncOutcome> {
  if (inflight) return inflight;
  inflight = runSyncOnce(updateWidget).finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function saveTopic(raw: string): Promise<void> {
  const settings = settingsFromInput(raw);
  if (!isValidTopic(settings.topic)) {
    throw new Error('Paste the topic from the computer. It uses letters, numbers, hyphens, or underscores.');
  }
  await saveSettings(settings.topic, settings.server);
}

export async function forgetTopic(): Promise<void> {
  await stopBackground();
  await cancelResetAlarms();
  await saveSettings('', 'https://ntfy.sh');
  await clearPlanData();
  await saveWidgetCache(emptyWidget);
  await pushWidget(emptyWidget);
}

async function runSyncOnce(updateWidget: boolean): Promise<SyncOutcome> {
  const settings = await loadSettings();
  if (!settings.topic) {
    return finish(emptyWidget, null, null, false, false, updateWidget);
  }
  const [previousWindows, scheduled, saved] = await Promise.all([
    loadWindows(),
    loadScheduled(),
    loadSnapshot(),
  ]);
  let snapshot = saved;
  let error: string | null = null;
  try {
    const latest = await fetchLatestSnapshot(fetch, settings.server, settings.topic);
    if (latest) {
      snapshot = latest;
      const alarms = planAlarms({
        previous: previousWindows,
        next: latest.windows,
        scheduled,
        now: Date.now(),
      });
      await Promise.all([
        saveSnapshot(latest),
        saveWindows(latest.windows),
        saveScheduled(alarms.scheduled),
      ]);
      await syncResetAlarms(latest.windows);
      if (alarms.notify.length > 0) {
        const note = resetNotification(alarms.notify);
        await notifyLocal(note.title, note.body);
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not read the topic.';
  }
  const waiting = snapshot == null && error == null;
  return finish(widgetFromSnapshot(snapshot, true), snapshot, error, true, waiting, updateWidget);
}

async function finish(
  widget: WidgetCache,
  snapshot: Snapshot | null,
  error: string | null,
  connected: boolean,
  waiting: boolean,
  updateWidget: boolean,
): Promise<SyncOutcome> {
  await saveWidgetCache(widget);
  if (updateWidget) await pushWidget(widget);
  return { snapshot, error, connected, waiting, widget };
}

export async function cachedWidget(): Promise<WidgetCache> {
  return loadWidgetCache();
}
