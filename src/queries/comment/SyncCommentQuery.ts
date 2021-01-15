import { CommentType } from "../../db/entities/Comment";

export interface SyncCommentQuery {
  owner: string;
  repo: string;
  pull_number: number;
  comment_type: CommentType;
  id: number;
  user: {
    login: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string;
  author_association: string;
  html_url: string;
}
