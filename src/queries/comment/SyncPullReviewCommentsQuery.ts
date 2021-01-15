export interface SyncPullReviewCommentsQuery {
  pull: {
    owner: string;
    repo: string;
    pull_number: number;
  };
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
