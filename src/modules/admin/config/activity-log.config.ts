export interface ActivityLogConfig {
  batchSize: number;
  attempts: number;
  backoffDelay: number;
  concurrency: number;
}

export const defaultActivityLogConfig: ActivityLogConfig = {
  batchSize: 50,
  attempts: 3,
  backoffDelay: 2000,
  concurrency: 1,
};
