import { Logger } from "probot";
import { Inject, Service, Token } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";

import { ILoggerToken } from "../common/token";
import { encodeLabelArray } from "../utils/parser";
import { time } from "../utils/time";

import { Pull } from "../db/entities/Pull";
import { SyncPullQuery } from "../queries/pull/SyncPullQuery";
import { SyncPullStatusQuery } from "../queries/pull/SyncPullStatusQuery";
import { PullKey } from "../common/types";

export const IPullServiceToken = new Token<IPullService>();

export interface IPullService {
  syncPullRequest(syncPullQuery: SyncPullQuery): Promise<void>;
  syncPullRequestStatus(query: SyncPullStatusQuery): Promise<void>;
  getContributorAllPullRequests(login: string): Promise<Pull[]>;
}

@Service(IPullServiceToken)
export class PullService implements IPullService {
  constructor(
    @InjectRepository(Pull)
    private pullRepository: Repository<Pull>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  /**
   * Synchronize the received pull request data to the database.
   * @param syncPullQuery
   */
  async syncPullRequest(syncPullQuery: SyncPullQuery) {
    const { owner, repo, number: pullNumber } = syncPullQuery;
    const pullSignature = `${owner}/${repo}#${pullNumber}`;

    // Get existing records from the database for comparison.
    let pullStored = await this.getPullRequestByPullKey({
      owner,
      repo,
      pull_number: pullNumber,
    });

    if (pullStored === undefined) {
      pullStored = PullService.makePull(syncPullQuery);
    }

    // Ignore outdated PR data.
    const isPRUpdated = PullService.isPullUpdated(syncPullQuery, pullStored);

    if (!isPRUpdated) {
      this.log.info(`sync pull request ${pullSignature}, but not updated`);
      return;
    }

    // Patch pull.
    const pullBeSaved = PullService.patchPull(pullStored, syncPullQuery);

    // Save pull.
    try {
      await this.pullRepository.save(pullBeSaved);
      this.log.info(`sync pull request ${pullSignature} success`);
    } catch (err) {
      this.log.error(`failed to sync pull request ${pullSignature}: ${err}`);
    }
  }

  /**
   * Synchronize the status change of Pull Request to the database.
   */
  async syncPullRequestStatus() {}

  /**
   * Get all pull requests of a contributor.
   * @param login Github login of contributor.
   */
  async getContributorAllPullRequests(login: string) {
    return await this.pullRepository.find({
      user: login,
    });
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
   * Determine whether the data has been updated.
   * @param pullReceived
   * @param pullStored
   * @private
   */
  private static isPullUpdated(
    pullReceived: SyncPullQuery,
    pullStored: Pull
  ): boolean {
    return time(pullReceived.updated_at).laterThan(time(pullStored.updatedAt));
  }
}
