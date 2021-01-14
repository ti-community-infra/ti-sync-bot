import { Logger } from "probot";
import { Inject, Service, Token } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";

import { ILoggerToken } from "../common/token";
import { timeALaterThanTimeB } from "../utils/util";
import { encodeLabelArray } from "../utils/parser";

import { Pull } from "../db/entities/Pull";
import { SyncPullQuery } from "../queries/SyncPullQuery";
import { SyncPullLabelsQuery } from "../queries/SyncPullLabelsQuery";
import { SyncPullStatusQuery } from "../queries/SyncPullStatusQuery";

export const IPullServiceToken = new Token<IPullService>();

export interface IPullService {
  syncPullRequest(syncPullQuery: SyncPullQuery): Promise<void>;
  syncPullRequestStatus(query: SyncPullStatusQuery): Promise<void>;
  syncPullRequestLabels(query: SyncPullLabelsQuery): Promise<void>;
}

@Service(IPullServiceToken)
export class PullService implements IPullService {
  constructor(
    @InjectRepository(Pull)
    private pullRepository: Repository<Pull>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  // TODO: refactor the sync pull request function.
  async syncPullRequest(syncPullQuery: SyncPullQuery) {
    const { owner, repo, pull } = syncPullQuery;
    const pullSignature = `${owner}/${repo}#${pull.number}`;

    // Get existing records from the database for comparison.
    let pullInDB = await this.pullRepository.findOne({
      where: {
        owner: owner,
        repo: repo,
        pullNumber: pull.number,
      },
    });

    if (pullInDB === undefined) {
      pullInDB = PullService.makePull(owner, repo, pull.number);
    }

    // TODO: use time.laterThan instead of timeALaterThanTimeB.
    // Ignore outdated PR data.
    const isPRUpdated = timeALaterThanTimeB(
      pull.updated_at,
      pullInDB.updatedAt
    );

    if (!isPRUpdated) {
      this.log.info(`sync pull request ${pullSignature}, but not updated`);
      return;
    }

    // Patch the merged status.
    let status = pull.state;
    if (pull.merged_at !== null && status == "closed") {
      status = "merged";
    }

    // TODO: patch the relation field.
    // Patch the relation field.
    pullInDB.relation =
      pull.author_association === "MEMBER" ? "member" : "not member";

    // Patch the labels field.
    pullInDB.label = encodeLabelArray(pull.labels);
    pullInDB.user = pull.user ? pull.user.login : "";
    pullInDB.status = status;
    pullInDB.title = pull.title;
    pullInDB.body = pull.body;
    pullInDB.association = pull.author_association;
    pullInDB.createdAt = pull.created_at;
    pullInDB.updatedAt = pull.updated_at;
    pullInDB.closedAt = pull.closed_at;
    pullInDB.mergedAt = pull.merged_at;

    try {
      await this.pullRepository.save(pullInDB);
      this.log.info(`sync pull request ${pullSignature}`);
    } catch (err) {
      this.log.error(`failed to sync pull request ${pullSignature}: ${err}`);
    }
  }

  async syncPullRequestStatus() {}

  async syncPullRequestLabels(query: SyncPullLabelsQuery) {
    console.log(query);
  }

  private static makePull(owner: string, repo: string, number: number): Pull {
    const pull = new Pull();

    pull.owner = owner;
    pull.repo = repo;
    pull.pullNumber = number;

    return pull;
  }
}
