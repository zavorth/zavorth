#!/usr/bin/env node
/**
 * Compute Docker image tags for GHCR / Docker Hub.
 * Usage: node scripts/docker-release-tags.mjs [ref]
 * Prints lines: IMAGE_TAG=<...> for GITHUB_OUTPUT.
 */
const ref = process.argv[2] || process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || 'dev';
const cleaned = String(ref).replace(/^refs\/tags\//, '').replace(/^refs\/heads\//, '') || 'dev';
const owner = (process.env.GITHUB_REPOSITORY_OWNER || 'zavorth').toLowerCase();
const repo = (process.env.GITHUB_REPOSITORY || `${owner}/zavorth`).split('/')[1] || 'zavorth';
const ghcr = `ghcr.io/${owner}/${repo}`;
const dockerhubUser = process.env.DOCKERHUB_USERNAME || owner;
const dockerhub = `${dockerhubUser}/${repo}`;

const tags = new Set([`${ghcr}:${cleaned}`, `${dockerhub}:${cleaned}`]);
if (/^v\d/.test(cleaned)) {
  tags.add(`${ghcr}:latest`);
  tags.add(`${dockerhub}:latest`);
}

// GITHUB_OUTPUT multiline-safe: comma list works for docker/build-push-action
const list = Array.from(tags);
// When Docker Hub secrets are absent, still emit GHCR tags first (Hub push needs login).
const ghcrOnly = list.filter((t) => t.startsWith('ghcr.io/'));
const preferGhcrOnly = process.env.DOCKER_TAGS_GHCR_ONLY === 'true';
const finalTags = preferGhcrOnly ? ghcrOnly : list;
console.log(`tags=${finalTags.join(',')}`);
console.log(`ghcr_image=${ghcr}`);
console.log(`dockerhub_image=${dockerhub}`);
console.log(`version_tag=${cleaned}`);
