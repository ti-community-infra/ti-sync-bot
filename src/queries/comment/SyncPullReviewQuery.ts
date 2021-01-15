export interface SyncPullReviewQuery {
  owner: string;
  repo: string;
  pull_number: number;
  id: number;
  user: {
    login: string;
  } | null;
  body: string;
  html_url: string;
  submitted_at?: string;
  author_association: string;
}
