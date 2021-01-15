import { Entity, Index, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({
  name: "comments",
})
export class Comment {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Column({ default: null })
  owner!: string;

  @Column({ default: null })
  repo!: string;

  @Column({ name: "pull_number", default: null })
  @Index()
  pullNumber!: number;

  @Column({ name: "comment_id", default: null })
  commentId!: number;

  @Column({ name: "comment_type", default: null })
  commentType!: string;

  @Column({ type: "text" })
  body: string = "";

  @Column({ default: null })
  user?: string;

  @Column({ default: null })
  url!: string;

  @Column({ default: null })
  association!: string;

  @Column({ default: null })
  relation!: string;

  @Column({
    name: "created_at",
    type: "timestamp",
    nullable: false,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: string;

  @Column({
    name: "updated_at",
    type: "timestamp",
    nullable: true,
    default: null,
  })
  updatedAt!: string;
}

export enum CommentType {
  COMMON_COMMENT = "common comment",
  REVIEW_COMMENT = "review comment",
  REVIEW = "review",
}
