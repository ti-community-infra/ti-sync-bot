import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Logger } from "probot";

import { time } from "../utils/time";
import { ILoggerToken } from "../common/token";

import { Comment, CommentType } from "../db/entities/Comment";
import { SyncPullReviewsQuery } from "../queries/SyncPullReviewsQuery";
import { SyncPullReviewCommentsQuery } from "../queries/SyncPullReviewCommentsQuery";
import { SyncPullCommentsQuery } from "../queries/SyncPullCommentsQuery";
import { SyncCommentQuery } from "../queries/SyncCommentQuery";

export const ICommentServiceToken = new Token<ICommentService>();

export interface ICommentService {
  syncPullRequestReviews(query: SyncPullReviewsQuery): Promise<void>;
  syncPullRequestComments(query: SyncPullCommentsQuery): Promise<void>;
  syncPullRequestReviewComments(
    query: SyncPullReviewCommentsQuery
  ): Promise<void>;
}

@Service(ICommentServiceToken)
export class CommentService implements ICommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  // TODO: Batch sync PR comments.
  async syncPullRequestReviews(query: SyncPullReviewsQuery) {
    const { pull, reviews } = query;

    reviews.forEach((review) => {
      let commentReceived: SyncCommentQuery = {
        comment_type: CommentType.REVIEW,
        created_at: review.submitted_at || "",
        updated_at: review.submitted_at || "",
        ...pull,
        ...review,
      };

      this.syncComment(commentReceived);
    });
  }

  async syncPullRequestReviewComments(query: SyncPullReviewCommentsQuery) {
    const { pull, review_comments: reviewComments } = query;

    reviewComments.forEach((reviewComment) => {
      let commentReceived: SyncCommentQuery = {
        comment_type: CommentType.REVIEW_COMMENT,
        ...pull,
        ...reviewComment,
      };

      this.syncComment(commentReceived);
    });
  }

  async syncPullRequestComments(query: SyncPullCommentsQuery) {
    const { pull, comments } = query;

    comments.forEach((comment) => {
      let commentReceived: SyncCommentQuery = {
        comment_type: CommentType.COMMON_COMMENT,
        body: comment.body || "",
        ...pull,
        ...comment,
      };

      this.syncComment(commentReceived).then(null);
    });
  }

  /**
   * Synchronize the received comment data to the database.
   * @param commentReceived
   */
  async syncComment(commentReceived: SyncCommentQuery) {
    const { repo, owner, id: commentId, comment_type: type } = commentReceived;
    const commentSignature = `${owner}/${repo}#${commentId}`;

    // Get comments from the database.
    let commentStored = await this.getCommentByCommentId(commentId);
    if (commentStored === undefined) {
      commentStored = CommentService.makeComment(commentReceived);
    }

    // Ignore outdated comment data.
    if (!CommentService.isCommentUpdated(commentReceived, commentStored)) {
      this.log.info(`sync ${type} ${commentSignature}, but not updated`);
      return;
    }

    // Patch comment.
    const commentBeSaved = CommentService.patchComment(
      commentStored,
      commentReceived
    );

    // Save comment.
    try {
      await this.commentRepository.save(commentBeSaved);
      this.log.info(`sync ${type} ${commentSignature} success`);
    } catch (err) {
      this.log.error(`failed to save ${type} ${commentSignature}: ${err}`);
    }
  }

  /**
   * Get comments from the database based on the comment ID.
   * @param commentId
   */
  private getCommentByCommentId(
    commentId: number
  ): Promise<Comment | undefined> {
    return this.commentRepository.findOne({
      where: {
        commentId: commentId,
      },
    });
  }

  /**
   * Make a new comment entity according the received data.
   * @param commentReceived
   */
  private static makeComment(commentReceived: SyncCommentQuery): Comment {
    const newComment = new Comment();

    // Notice: These attributes must not be changed in the future.
    newComment.pullNumber = commentReceived.pull_number;
    newComment.commentId = commentReceived.id;
    newComment.commentType = commentReceived.comment_type;
    newComment.createdAt = commentReceived.created_at;
    newComment.user = commentReceived.user?.login;

    return newComment;
  }

  /**
   * Patch the comment attributes that need to be updated.
   * @param commentStored
   * @param commentReceived
   * @return Comment after patch.
   */
  private static patchComment(
    commentStored: Comment,
    commentReceived: SyncCommentQuery
  ): Comment {
    const newComment = Object.assign({}, commentStored);

    newComment.repo = commentReceived.repo;
    newComment.owner = commentReceived.owner;
    newComment.body = commentReceived.body;
    newComment.updatedAt = commentReceived.updated_at;
    newComment.association = commentReceived.author_association;
    newComment.url = commentReceived.html_url;

    if (commentReceived.author_association === "MEMBER") {
      newComment.relation = "member";
    } else {
      newComment.relation = "not member";
    }

    return newComment;
  }

  private static isCommentUpdated(
    commentReceived: SyncCommentQuery,
    commentStored: Comment
  ): boolean {
    return time(commentReceived.updated_at).laterThan(
      time(commentStored.updatedAt)
    );
  }
}
