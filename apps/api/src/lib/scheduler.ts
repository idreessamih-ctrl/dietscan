import { query } from "./db";
import { sendPushNotification } from "../services/notifications";

let dailyReminderLastRun: string | null = null;
let weeklySummaryLastRun: string | null = null;

async function checkUserStreakMilestones(userId: string, pushToken: string): Promise<void> {
  try {
    // Fetch distinct log dates in descending order
    const result = await query<{ log_date: Date }>(
      `SELECT DISTINCT (scanned_at AT TIME ZONE 'UTC')::date as log_date
       FROM meal_journal
       WHERE user_id = $1
       ORDER BY log_date DESC`,
      [userId]
    );

    if (result.rows.length === 0) return;

    // Normalize dates to midnight in local comparison format
    const dates = result.rows.map((r) => {
      const d = new Date(r.log_date);
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const mostRecent = dates[0];
    // Check if the user logged today or yesterday. If not, streak is broken.
    if (mostRecent.getTime() !== today.getTime() && mostRecent.getTime() !== yesterday.getTime()) {
      return;
    }

    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const diffTime = dates[i].getTime() - dates[i + 1].getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else if (diffDays > 1) {
        break;
      }
    }

    if (streak === 7 || streak === 30 || streak === 100) {
      await sendPushNotification(
        pushToken,
        "Streak Milestone! 🏆",
        `Congratulations! You've logged your meals for ${streak} consecutive days! Keep it up!`,
        { type: "streak_milestone", streak }
      );
    }
  } catch (error) {
    console.error(`[Scheduler] Error checking streak for user ${userId}:`, error);
  }
}

async function runDailyReminder(): Promise<void> {
  console.log("[Scheduler] Running daily reminder and streak milestone tasks...");
  try {
    const usersRes = await query<{ id: string; push_token: string }>(
      "SELECT id, push_token FROM users WHERE push_token IS NOT NULL"
    );

    for (const user of usersRes.rows) {
      await sendPushNotification(
        user.push_token,
        "Daily Reminder 🍽️",
        "Don't forget to log your meals today!",
        { type: "journal_reminder" }
      );

      // Check streak milestones
      await checkUserStreakMilestones(user.id, user.push_token);
    }
  } catch (err) {
    console.error("[Scheduler] Error running daily reminder:", err);
  }
}

async function runWeeklySummary(): Promise<void> {
  console.log("[Scheduler] Running weekly summary tasks...");
  try {
    const usersRes = await query<{ id: string; push_token: string }>(
      "SELECT id, push_token FROM users WHERE push_token IS NOT NULL"
    );

    for (const user of usersRes.rows) {
      await sendPushNotification(
        user.push_token,
        "Weekly Compliance Summary 📊",
        "Your weekly compliance summary is ready. Tap to view your performance!",
        { type: "weekly_summary" }
      );
    }
  } catch (err) {
    console.error("[Scheduler] Error running weekly summary:", err);
  }
}

/**
 * Main tick function running every 60 seconds
 */
export function tickScheduler(): void {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 is Sunday, 6 is Saturday

  // Format today's date as YYYY-MM-DD in local time
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Daily at 8 PM (hour 20)
  if (currentHour === 20) {
    if (dailyReminderLastRun !== todayStr) {
      dailyReminderLastRun = todayStr;
      runDailyReminder().catch((err) =>
        console.error("[Scheduler] Exception in runDailyReminder:", err)
      );
    }
  }

  // Weekly Sunday at 10 AM (day 0, hour 10)
  if (currentDay === 0 && currentHour === 10) {
    if (weeklySummaryLastRun !== todayStr) {
      weeklySummaryLastRun = todayStr;
      runWeeklySummary().catch((err) =>
        console.error("[Scheduler] Exception in runWeeklySummary:", err)
      );
    }
  }
}

/**
 * Starts the scheduler loop checking times every 60 seconds
 */
export function startScheduler(): void {
  console.log("[Scheduler] Push notifications scheduler started.");
  // Run an immediate check on startup, then every 60 seconds
  tickScheduler();
  setInterval(() => {
    tickScheduler();
  }, 60 * 1000);
}
