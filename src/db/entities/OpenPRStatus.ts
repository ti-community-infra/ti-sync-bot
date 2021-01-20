import { Entity, Index, Column, PrimaryColumn } from "typeorm";

@Entity({
  name: "open_pr_status",
})
@Index(["owner", "repo", "pullNumber"], { unique: true })
export class OpenPRStatus {
  @PrimaryColumn({ default: null })
  owner!: string;

  @PrimaryColumn({ default: null })
  repo!: string;

  @Index()
  @PrimaryColumn({ name: "pull_number", default: null })
  pullNumber!: number;

  @Column({
    name: "last_comment_at",
    type: "timestamp",
    nullable: true,
    default: null,
  })
  lastCommentAt!: string;

  @Column({
    name: "last_review_at",
    type: "timestamp",
    nullable: true,
    default: null,
  })
  lastReviewAt!: string;

  @Column({
    name: "last_update_code_at",
    type: "timestamp",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  lastUpdateCodeAt!: string;
}
