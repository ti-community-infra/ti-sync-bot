import { Logger } from "probot";
import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { ILoggerToken } from "../common/token";
import { encodeLabelArray } from "../utils/parser";
import { time } from "../utils/time";

import { Pull } from "../db/entities/Pull";
import { SyncPullQuery } from "../queries/pull/SyncPullQuery";
import { SyncPullStatusQuery } from "../queries/pull/SyncPullStatusQuery";
import { PullKey } from "../common/types";
import { Repository } from "typeorm";
import { OpenPRStatus } from "../db/entities/OpenPRStatus";
import { SyncPullLastCommentQuery } from "../queries/pull/SyncPullLastCommentQuery";
import { SyncPullLastReviewQuery } from "../queries/pull/SyncPullLastReviewQuery";
import { SyncPullLastCommitQuery } from "../queries/pull/SyncPullLastCommitQuery";

export const IPullServiceToken = new Token<IPullService>();

export interface IPullService {
  syncPullRequest(syncPullQuery: SyncPullQuery): Promise<void>;
  syncPullRequestUpdateTime(
    pullKey: PullKey,
    updateTime: string
  ): Promise<void>;

  syncOpenPullRequestStatus(query: SyncPullStatusQuery): Promise<void>;
  syncOpenPRLastReviewTime(query: SyncPullLastReviewQuery): Promise<void>;
  syncOpenPRLastCommentTime(query: SyncPullLastCommentQuery): Promise<void>;
  syncOpenPRLastCommitTime(query: SyncPullLastCommitQuery): Promise<void>;

  getContributorAllPullRequests(login: string): Promise<Pull[]>;
}

@Service(IPullServiceToken)
export class PullService implements IPullService {
  constructor(
    @InjectRepository(Pull)
    private pullRepository: Repository<Pull>,
    @InjectRepository(OpenPRStatus)
    private openPRStatusRepository: Repository<OpenPRStatus>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  /**
   * Synchronize the received pull request data to the database.
   * @param pullReceived
   */
  async syncPullRequest(pullReceived: SyncPullQuery) {
    const { owner, repo, number: pullNumber } = pullReceived;
    const pullSignature = `${owner}/${repo}#${pullNumber}`;

    // Get existing records from the database for comparison.
    let pullStored = await this.getPullRequestByPullKey({
      owner,
      repo,
      pull_number: pullNumber,
    });

    if (pullStored === undefined) {
      pullStored = PullService.makePull(pullReceived);
    }

    // Ignore outdated PR data.
    const isPRUpdated = time(pullReceived.updated_at).laterThan(
      time(pullStored.updatedAt)
    );

    if (!isPRUpdated) {
      this.log.info(`sync pull request ${pullSignature}, but not updated`);
      return;
    }

    // Patch pull.
    const pullBeSaved = PullService.patchPull(pullStored, pullReceived);

    // Save pull.
    try {
      await this.pullRepository.save(pullBeSaved);
      this.log.info(`sync pull request ${pullSignature} success`);
    } catch (err) {
      this.log.error(`failed to sync pull request ${pullSignature}: ${err}`);
    }
  }

  /**
   * Get pull request from the database based on the issue number.
   * @param pullKey
   */
  private getPullRequestByPullKey(pullKey: PullKey): Promise<Pull | undefined> {
    return this.pullRepository.findOne({
      where: {
        owner: pullKey.owner,
        repo: pullKey.repo,
        pullNumber: pullKey.pull_number,
      },
    });
  }

  /**
   * Make a new pull request entity according the received data.
   * @param pullReceived
   */
  private static makePull(pullReceived: SyncPullQuery): Pull {
    const newPull = new Pull();

    // Notice: These attributes must not be changed in the future.
    newPull.pullNumber = pullReceived.number;
    newPull.createdAt = pullReceived.created_at;

    return newPull;
  }

  /**
   * Patch the pull request attributes that need to be updated.
   * @param pullStored
   * @param pullReceived
   * @return pull request after patch.
   */
  private static patchPull(
    pullStored: Pull,
    pullReceived: SyncPullQuery
  ): Pull {
    // Patch the merged status.
    let status = pullReceived.state;

    if (pullReceived.merged_at !== null && status == "closed") {
      status = "merged";
    }

    // Patch the relation field.
    const relation =
      pullReceived.author_association === "MEMBER" ? "member" : "not member";

    return {
      ...pullStored,
      owner: pullReceived.owner,
      repo: pullReceived.repo,
      title: pullReceived.title,
      body: pullReceived.body,
      user: pullReceived.user ? pullReceived.user.login : "",
      status: status,
      label: encodeLabelArray(pullReceived.labels),
      association: pullReceived.author_association,
      relation: relation,
      createdAt: pullReceived.created_at,
      updatedAt: pullReceived.updated_at,
      closedAt: pullReceived.closed_at,
      mergedAt: pullReceived.merged_at,
    };
  }

  /**
   * Sync update time of pull request.
   */
  async syncPullRequestUpdateTime(pullKey: PullKey, updateTime: string) {
    await this.pullRepository.update(
      {
        owner: pullKey.owner,
        repo: pullKey.repo,
        pullNumber: pullKey.pull_number,
      },
      {
        updatedAt: updateTime,
      }
    );
  }

  /**
   * Get all pull requests of a contributor.
   * @param login Github login of contributor.
   */
  async getContributorAllPullRequests(login: string) {
    // TODO: Ensure that all pull requests from contributors can be obtained.
    return await this.pullRepository.find({
      user: login,
    });
  }

  /**
   * Synchronize the status change of Pull Request to the database.
   * @param query
   */
  async syncOpenPullRequestStatus(query: SyncPullStatusQuery) {
    const {
      pull,
      reviews,
      comments: issueComments,
      review_comments: reviewComments,
      commits,
    } = query;

    let pullAuthorLogin = pull.user !== null ? pull.user.login : null;
    let lastReviewTime;
    let lastCommentTime;
    let lastCommitTime;

    // Get the last review time of PR.
    for (let review of reviews) {
      if (
        review.submitted_at !== undefined &&
        time(review.submitted_at).laterThan(time(lastReviewTime))
      ) {
        lastReviewTime = review.submitted_at;
      }
    }

    // Get the last comment time of PR.
    for (let reviewComment of reviewComments) {
      // Notice: Ignore comments submitted by the PR author himself.
      if (reviewComment.user?.login === pullAuthorLogin) continue;

      if (time(reviewComment.updated_at).laterThan(time(lastCommentTime))) {
        lastCommentTime = reviewComment.updated_at;
      }
    }

    for (let issueComment of issueComments) {
      // Notice: Ignore comments submitted by the PR author himself.
      if (issueComment.user?.login === pullAuthorLogin) continue;

      if (time(issueComment.updated_at).laterThan(time(lastCommentTime))) {
        lastCommentTime = issueComment.updated_at;
      }
    }

    // Get the last commit time of PR.
    for (let commit of commits) {
      const commitTime = commit.commit.committer?.date;

      if (time(commitTime).laterThan(time(lastCommitTime))) {
        lastCommitTime = commitTime;
      }
    }

    await this.updatePRStatus({
      ...pull,
      lastCommentTime,
      lastReviewTime,
      lastCommitTime,
    });
  }

  async syncOpenPRLastCommentTime(query: SyncPullLastCommentQuery) {
    const { pull, last_comment_time: lastCommentTime } = query;

    await this.updatePRStatus({
      ...pull,
      lastCommentTime,
    });
  }

  async syncOpenPRLastReviewTime(query: SyncPullLastReviewQuery) {
    const { pull, last_review_time: lastReviewTime } = query;

    await this.updatePRStatus({
      ...pull,
      lastReviewTime,
    });
  }

  async syncOpenPRLastCommitTime(query: SyncPullLastCommitQuery) {
    const { pull, last_commit_time: lastCommitTime } = query;

    await this.updatePRStatus({
      ...pull,
      lastCommitTime,
    });
  }

  /**
   * Insert or update open_pr_status record.
   * @private
   */
  private async updatePRStatus(
    pullStatus: PullKey & {
      lastCommentTime?: string;
      lastReviewTime?: string;
      lastCommitTime?: string;
    }
  ) {
    let openPRStatusStored = await this.openPRStatusRepository.findOne({
      owner: pullStatus.owner,
      repo: pullStatus.repo,
      pullNumber: pullStatus.pull_number,
    });
    let openPRStatusBeSaved = new OpenPRStatus();

    if (openPRStatusStored !== undefined) {
      openPRStatusBeSaved.owner = openPRStatusStored.owner;
      openPRStatusBeSaved.repo = openPRStatusStored.repo;
      openPRStatusBeSaved.pullNumber = openPRStatusStored.pullNumber;
      openPRStatusBeSaved.lastUpdateCodeAt =
        openPRStatusStored.lastUpdateCodeAt;
      openPRStatusBeSaved.lastCommentAt = openPRStatusStored.lastCommentAt;
      openPRStatusBeSaved.lastReviewAt = openPRStatusStored.lastReviewAt;
    } else {
      openPRStatusBeSaved.owner = pullStatus.owner;
      openPRStatusBeSaved.repo = pullStatus.repo;
      openPRStatusBeSaved.pullNumber = pullStatus.pull_number;
    }

    if (pullStatus.lastCommentTime !== undefined) {
      openPRStatusBeSaved.lastCommentAt = pullStatus.lastCommentTime;
    }

    if (pullStatus.lastReviewTime !== undefined) {
      openPRStatusBeSaved.lastReviewAt = pullStatus.lastReviewTime;
    }

    if (pullStatus.lastCommitTime !== undefined) {
      openPRStatusBeSaved.lastUpdateCodeAt = pullStatus.lastCommitTime;
    }

    await this.openPRStatusRepository.save(openPRStatusBeSaved);
  }
}
