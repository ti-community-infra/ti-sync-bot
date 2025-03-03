export interface SyncPullCommentQuery {
  owner: string;
  repo: string;
  pull_number: number;
  id: number;
  user: {
    login: string;
  } | null;
  body?: string;
  created_at: string;
  updated_at: string;
  author_association: string;
  html_url: string;
}
