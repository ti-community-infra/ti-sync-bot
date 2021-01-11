import { Context, ProbotOctokit } from "probot";
import { IPullService } from "../../services/PullService";
import { sleep } from "../../utils/util";

interface RepoConfig {
  owner: string;
  repo: string;
}

export async function handleAppStartUpEvent(
  gc: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService
) {
  // TODO: get repositories from installed list.
  const repoConfigs: RepoConfig[] = [{ owner: "pingcap", repo: "br" }];

  for (let repoConfig of repoConfigs) {
    await handleSyncRepo(repoConfig, gc, pullService);
  }
}

export function handleAppInstallOnRepoEvent(
  context: Context,
  pullService: IPullService
) {
  let repoConfig = context.repo();

  handleSyncRepo(repoConfig, context.octokit, pullService).then(null);
}

async function handleSyncRepo(
  repoConfig: RepoConfig,
  gc: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService
) {
  const iterator = gc.paginate.iterator(gc.pulls.list, {
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

  for await (const res of iterator) {
    for (const pull of res.data) {
      await pullService.syncPullRequest({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        pull,
      });
    }

    await sleep(1000);
  }
}
