import { ZavorthMemoryLearningLoopService } from '../src/services/ZavorthMemoryLearningLoopService.js';

const json = process.argv.includes('--json');

async function main(): Promise<void> {
  const service = new ZavorthMemoryLearningLoopService();
  const status = await service.buildStatus();
  const skillAssessment = await service.assessSkillCandidate({
    intent: 'summarize a github pr and list changed files',
    requestedBy: 'zavorth-runtime',
    sourceSurface: 'memory-learning-loop',
  });
  const search = await service.search({
    query: 'github pr summary',
    userId: 'zavorth-runtime',
    layers: ['skill', 'persistent'],
    limit: 5,
  });
  const snapshot = {
    generatedAt: new Date().toISOString(),
    status: 'ready',
    layers: status.layers,
    policy: status.policy,
    skillAssessment: {
      decision: skillAssessment.decision,
      scores: skillAssessment.scores,
      reasons: skillAssessment.reasons,
    },
    recall: {
      total: search.total,
      topKOnly: search.receipt.controls.topKOnly,
      untrustedOnRecall: search.receipt.controls.untrustedOnRecall,
    },
  };

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log('Zavorth Memory Learning Loop');
  console.log(`status: ${snapshot.status}`);
  console.log(`layers: session=${snapshot.layers.session}, persistent=${snapshot.layers.persistent}, skill=${snapshot.layers.skill}`);
  console.log(`skill candidate: ${snapshot.skillAssessment.decision}`);
  console.log(`recall: ${snapshot.recall.total} top-k result(s), untrusted=${snapshot.recall.untrustedOnRecall}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
