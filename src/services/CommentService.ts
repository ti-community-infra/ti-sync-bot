import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Logger } from "probot";

import { time } from "../utils/time";
import { ILoggerToken } from "../common/token";

import { Comment, CommentType } from "../db/entities/Comment";
import { SyncPullReviewsQuery } from "../queries/comment/SyncPullReviewsQuery";
import { SyncPullReviewCommentsQuery } from "../queries/comment/SyncPullReviewCommentsQuery";
import { SyncPullCommentsQuery } from "../queries/comment/SyncPullCommentsQuery";
import { SyncCommentQuery } from "../queries/comment/SyncCommentQuery";
import { SyncPullReviewQuery } from "../queries/comment/SyncPullReviewQuery";
import { SyncPullCommentQuery } from "../queries/comment/SyncPullCommentQuery";
import { SyncPullReviewCommentQuery } from "../queries/comment/SyncPullReviewCommentQuery";

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
  /**
   * Handle reviews of a pull request.
   * @param query
   */
  async syncPullRequestReviews(query: SyncPullReviewsQuery) {
    const { pull, reviews } = query;

    reviews.forEach((review) => {
      this.syncPullRequestReview({
        ...pull,
        ...review,
      });
    });
  }

  async syncPullRequestReview(query: SyncPullReviewQuery) {
    let commentReceived: SyncCommentQuery = {
      ...query,
      comment_type: CommentType.REVIEW,
      created_at: query.submitted_at || "",
      updated_at: query.submitted_at || "",
    };

    this.syncComment(commentReceived).then(null);
  }

  /**
   * Handle review comments of a pull request.
   * @param query
   */
  async syncPullRequestReviewComments(query: SyncPullReviewCommentsQuery) {
    const { pull, review_comments: reviewComments } = query;

    reviewComments.forEach((reviewComment) => {
      this.syncPullRequestReviewComment({
        ...pull,
        ...reviewComment,
      });
    });
  }

  async syncPullRequestReviewComment(query: SyncPullReviewCommentQuery) {
    let commentReceived: SyncCommentQuery = {
      ...query,
      comment_type: CommentType.REVIEW_COMMENT,
    };

    await this.syncComment(commentReceived);
  }

  /**
   * Handle common comments of a pull request.
   * @param query
   */
  async syncPullRequestComments(query: SyncPullCommentsQuery) {
    const { pull, comments } = query;

    comments.forEach((comment) => {
      this.syncPullRequestComment({
        ...pull,
        ...comment,
      });
    });
  }

  async syncPullRequestComment(query: SyncPullCommentQuery) {
    let commentReceived: SyncCommentQuery = {
      ...query,
      comment_type: CommentType.COMMON_COMMENT,
      body: query.body || "",
    };

    await this.syncComment(commentReceived);
  }

  /**
   * Synchronize the received comment data to the database.
   * @param commentReceived The type of received comment can be review, review comment and common comment.
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
    const newComment: Comment = {
      ...commentStored,
      repo: commentReceived.repo,
      owner: commentReceived.owner,
      body: commentReceived.body,
      updatedAt: commentReceived.updated_at,
      association: commentReceived.author_association,
      url: commentReceived.html_url,
    };

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
