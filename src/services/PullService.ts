import { SyncPullQuery } from "../queries/SyncPullQuery";
import { Inject, Service, Token } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Pull } from "../db/entities/Pull";
import { Repository } from "typeorm";
import { ILoggerToken } from "../common/global";
import { DeprecatedLogger } from "probot/lib/types";
import { isBefore } from "../utils/util";
import { encodeLabelArray } from "../utils/parser";

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
    private log: DeprecatedLogger
  ) {}

  async syncPullRequest(syncPullQuery: SyncPullQuery) {
    let { owner, repo, pull } = syncPullQuery;

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

    const isPRUpdated = isBefore(pullInDB.updatedAt, pull.updated_at);
    if (isPRUpdated) {
      this.log.debug(
        `sync pull request ${owner}/${repo}#${pull.number}, but not updated`
      );
      return;
    }

    // Patch the merged status.
    let status = pull.state;

    if (pull.merged_at !== null) {
      status = "merged";
    }

    // TODO: patch the relation field.
    pullInDB.relation =
      pull.author_association === "MEMBER" ? "member" : "not member";

    pullInDB.owner = owner;
    pullInDB.repo = repo;
    pullInDB.pullNumber = pull.number;
    pullInDB.title = pull.title;
    pullInDB.body = pull.body;
    pullInDB.label = encodeLabelArray(pull.labels);
    pullInDB.status = status;
    pullInDB.user = pull.user ? pull.user.login : "";
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
