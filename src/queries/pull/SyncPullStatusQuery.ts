export interface SyncPullStatusQuery {
  owner: string;
  repo: string;
  pull_number: number;
  updated_at: string;
  comments: {
    id: number;
    user: {
      login: string;
    } | null;
    body?: string;
    created_at: string;
    updated_at: string;
    author_association: string;
    html_url: string;
  }[];
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
  review_comments: {
    id: number;
    user: {
      login: string;
    } | null;
    body: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    author_association: string;
  }[];
}
