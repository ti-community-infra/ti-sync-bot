export interface SyncPullLastCommitQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
  };
  last_commit_time: string;
}
