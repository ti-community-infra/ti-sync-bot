import { Logger } from "probot";
import { Inject, Service, Token } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";

import { ILoggerToken } from "../common/token";
import { timeALaterThanTimeB } from "../utils/util";
import { encodeLabelArray } from "../utils/parser";

import { Pull } from "../db/entities/Pull";
import { SyncPullQuery } from "../queries/SyncPullQuery";

export const IPullServiceToken = new Token<IPullService>();

export interface IPullService {
  syncPullRequest(syncPullQuery: SyncPullQuery): Promise<void>;
}

@Service(IPullServiceToken)
export class PullService implements IPullService {
  constructor(
    @InjectRepository(Pull)
    private pullRepository: Repository<Pull>,
    @Inject(ILoggerToken)
    private log: Logger
  ) {}

  async syncPullRequest(syncPullQuery: SyncPullQuery) {
    let { owner, repo, pull } = syncPullQuery;

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

    // Ignore outdated PR data.
    const isPRUpdated = timeALaterThanTimeB(
      pull.updated_at,
      pullInDB.updatedAt
    );

    if (!isPRUpdated) {
      this.log.info(
        `sync pull request ${owner}/${repo}#${pull.number}, but not updated`
      );
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
      this.log.info(`sync pull request ${owner}/${repo}#${pull.number}`);
    } catch (err) {
      this.log.error(
        `failed to sync pull request ${owner}/${repo}#${pull.number}: ${err}`,
        err
      );
    }
  }

  async syncPullRequestStatus() {}

  private static makePull(owner: string, repo: string, number: number): Pull {
    const pull = new Pull();

    pull.owner = owner;
    pull.repo = repo;
    pull.pullNumber = number;

    return pull;
  }
}
