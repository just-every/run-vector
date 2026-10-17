import { deliverFollowups } from '../features/notification-followups/service';
import { sendDueReminders } from "../features/due-reminders/service";
import { closeEndedCycles } from "../features/cycle-closure/service";
import { drainNotificationMail } from "../features/notifications/mail";
import { dispatchWebhooks } from "../features/integrations/outbound";
import { returnDueIntake } from "../features/intake-return/service";
import { processFileRemovals } from "../features/file-removal/service";
import type { WorkerBindings } from "./server";
/** Export shared by the emitted Worker and the scheduled public-door tests. */
export async function scheduled(
  event: Pick<ScheduledController, "scheduledTime">,
  env: WorkerBindings,
) {
  const now = new Date(event.scheduledTime);
  await Promise.all([
    closeEndedCycles(env, now),
    sendDueReminders(env, now),
    deliverFollowups(env, now),
    processFileRemovals(env),
    returnDueIntake(env, now),
    drainNotificationMail(env, { scheduled: true }),
    dispatchWebhooks(env),
  ]);
}
