export interface SyncIssueCommentsQuery {
  issue: {
    owner: string;
    repo: string;
    issue_number: number;
  };
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
}
