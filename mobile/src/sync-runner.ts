import { cancelResetAlarms, notifyLocal, syncResetAlarms } from './alerts';
import { isValidTopic } from './model';
import type { Snapshot } from './model';
import { fetchLatestSnapshot, settingsFromInput } from './ntfy';
import { decodePairing } from './pairing';
import { fetchRelaySnapshot } from './relay';
import { stopBackground } from './register-background';
import {
  WidgetCache,
  clearPlanData,
  emptyWidget,
  loadLink,
  loadScheduled,
  loadSnapshot,
  loadWidgetCache,
  loadWindows,
  saveLink,
  saveScheduled,
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
  const pairing = decodePairing(raw);
  if (pairing) {
    await saveLink(pairing);
    return;
  }
  const settings = settingsFromInput(raw);
  if (!isValidTopic(settings.topic)) {
    throw new Error('Paste the pairing code, or a topic that uses letters, numbers, hyphens, or underscores.');
  }
  await saveLink({ kind: 'ntfy', topic: settings.topic, server: settings.server });
}

export async function forgetTopic(): Promise<void> {
  await stopBackground();
  await cancelResetAlarms();
  await saveLink({ kind: 'ntfy', topic: '', server: 'https://ntfy.sh' });
  await clearPlanData();
  await saveWidgetCache(emptyWidget);
  await pushWidget(emptyWidget);
}

async function runSyncOnce(updateWidget: boolean): Promise<SyncOutcome> {
  const link = await loadLink();
  if (!link || (link.kind === 'ntfy' && !link.topic)) {
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
    const latest =
      link.kind === 'relay'
        ? await fetchRelaySnapshot(fetch, link)
        : await fetchLatestSnapshot(fetch, link.server, link.topic);
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
