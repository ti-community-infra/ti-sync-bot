export interface SyncPullReviewsQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
  };
  reviews: {
    id: number;
    user: {
      login: string;
    } | null;
    body: string;
    html_url: string;
    submitted_at?: string;
    author_association: string;
  }[];
}
