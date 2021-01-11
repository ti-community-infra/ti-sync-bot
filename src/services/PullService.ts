import { SyncPullQuery } from "../queries/SyncPullQuery";
import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Pull } from "../db/entities/Pull";
import { Repository } from "typeorm";
import { ILoggerToken } from "../common/global";
import { timeALaterThanTimeB } from "../utils/util";
import { encodeLabelArray } from "../utils/parser";
import { Logger } from "probot";

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
      pullInDB = new Pull();
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

    // TODO: patch the relation field.
    // Patch the relation field.
    pullInDB.relation =
      pull.author_association === "MEMBER" ? "member" : "not member";
    // Patch the merged status.
    pullInDB.status = pull.merged_at !== null ? "merged" : pull.state;
    // Patch the labels field.
    pullInDB.label = encodeLabelArray(pull.labels);

    pullInDB.user = pull.user ? pull.user.login : "";

    pullInDB.owner = owner;
    pullInDB.repo = repo;
    pullInDB.pullNumber = pull.number;
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
}
