/**
 * PostgreSQL-Backed Queue Manager
 * Replaces BullMQ/Redis connections to run the scheduler entirely off PostgreSQL.
 */

export const QUEUE_NAME = 'email-sending-queue';

// Stub queue representation to prevent import errors in other modules
export const emailQueue = {
  name: QUEUE_NAME,
  add: async (name: string, data: any, opts?: any) => {
    console.log(`[Queue Board] Mock add job: ${name}`, data, opts);
    return { id: data.emailId || 'mock-id' };
  },
  getJobs: async () => [],
};

/**
 * Registers an email job in the queue.
 * For the custom PostgreSQL scheduler, we simply log the registration, 
 * as the daemon loop will pick up the email automatically using database status.
 */
export async function scheduleEmailJob(emailId: string, delayMs: number) {
  console.log(`[Scheduler] Email ${emailId} registered to send in ${Math.max(0, delayMs)}ms (Queued in PostgreSQL)`);
  return { id: `email-${emailId}` };
}
export default emailQueue;
