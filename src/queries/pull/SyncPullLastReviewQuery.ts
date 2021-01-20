export interface SyncPullLastReviewQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
  };
  last_review_time: string;
}
