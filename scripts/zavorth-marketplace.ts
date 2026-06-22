import { ZavorthSkillMarketplaceService } from '../src/services/ZavorthSkillMarketplaceService.js';
import type { ZavorthMarketplaceSortMode } from '../src/contracts/ZavorthSkillMarketplaceContract.js';

type CliOptions = {
  command: string;
  args: string[];
  json: boolean;
  category: string | null;
  sort: ZavorthMarketplaceSortMode | null;
  limit: number | null;
  rating: number | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: '',
    args: [],
    json: false,
    category: null,
    sort: null,
    limit: null,
    rating: null,
  };

  let argIndex = 0;

  if (argv.length > 0 && !argv[0].startsWith('--')) {
    options.command = argv[0];
    argIndex = 1;
  }

  while (argIndex < argv.length) {
    const arg = argv[argIndex];

    if (arg === '--json') {
      options.json = true;
      argIndex += 1;
      continue;
    }

    if (arg === '--category' && argIndex + 1 < argv.length) {
      options.category = argv[argIndex + 1];
      argIndex += 2;
      continue;
    }

    if (arg === '--sort' && argIndex + 1 < argv.length) {
      const value = argv[argIndex + 1];
      if (value === 'popular' || value === 'recent' || value === 'rating') {
        options.sort = value;
      }
      argIndex += 2;
      continue;
    }

    if (arg === '--limit' && argIndex + 1 < argv.length) {
      const parsed = parseInt(argv[argIndex + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      argIndex += 2;
      continue;
    }

    if (arg === '--rating' && argIndex + 1 < argv.length) {
      const parsed = parseInt(argv[argIndex + 1], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        options.rating = parsed;
      }
      argIndex += 2;
      continue;
    }

    if (!arg.startsWith('--')) {
      options.args.push(arg);
    }
    argIndex += 1;
  }

  return options;
}

function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const marketplace = new ZavorthSkillMarketplaceService();

  switch (opts.command) {
    case 'list': {
      const categories = marketplace.listCategories();
      if (opts.json) {
        output(categories, true);
      } else {
        console.log('Categories:');
        for (const cat of categories) {
          console.log(`  ${cat.id} - ${cat.label} (${cat.skillCount} skills)`);
          console.log(`    ${cat.description}`);
        }
      }
      break;
    }

    case 'search': {
      const query = opts.args[0] || '';
      const result = marketplace.search({
        query: query || undefined,
        category: opts.category || undefined,
        sort: opts.sort || undefined,
        limit: opts.limit || undefined,
      });
      if (opts.json) {
        output(result, true);
      } else {
        console.log(`Found ${result.total} skill(s):`);
        for (const entry of result.entries) {
          console.log(`  ${entry.id} - ${entry.name}`);
          console.log(`    ${entry.description}`);
          console.log(`    Category: ${entry.category} | Rating: ${entry.rating}/5 | Downloads: ${entry.downloads}`);
        }
      }
      break;
    }

    case 'install': {
      const skillId = opts.args[0];
      if (!skillId) {
        console.error('Error: skill ID is required');
        process.exitCode = 1;
        return;
      }
      const result = marketplace.installSkill({ skillId });
      if (opts.json) {
        output(result, true);
      } else if (result.installed) {
        console.log(`Installed: ${skillId}`);
        console.log(`Path: ${result.skillPath}`);
        if (result.warnings.length > 0) {
          console.log('Warnings:');
          for (const w of result.warnings) console.log(`  - ${w}`);
        }
      } else {
        console.error(`Failed to install ${skillId}:`);
        for (const w of result.warnings) console.error(`  - ${w}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'info': {
      const skillId = opts.args[0];
      if (!skillId) {
        console.error('Error: skill ID is required');
        process.exitCode = 1;
        return;
      }
      const skill = marketplace.getSkill(skillId);
      if (!skill) {
        console.error(`Skill not found: ${skillId}`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        output(skill, true);
      } else {
        console.log(`Name: ${skill.name}`);
        console.log(`ID: ${skill.id}`);
        console.log(`Description: ${skill.description}`);
        console.log(`Author: ${skill.author}`);
        console.log(`Version: ${skill.version}`);
        console.log(`License: ${skill.license}`);
        console.log(`Category: ${skill.category}`);
        console.log(`Tags: ${skill.tags.join(', ')}`);
        console.log(`Rating: ${skill.rating}/5`);
        console.log(`Downloads: ${skill.downloads}`);
        console.log(`Updated: ${skill.updatedAt}`);
        console.log(`Path: ${skill.skillPath}`);
      }
      break;
    }

    case 'rate': {
      const skillId = opts.args[0];
      if (!skillId || opts.rating === null) {
        console.error('Error: skill ID and --rating <1-5> are required');
        process.exitCode = 1;
        return;
      }
      const success = marketplace.rateSkill(skillId, opts.rating);
      if (opts.json) {
        output({ skillId, rating: opts.rating, success }, true);
      } else if (success) {
        console.log(`Rated ${skillId}: ${opts.rating}/5`);
      } else {
        console.error(`Failed to rate ${skillId}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'stats': {
      const stats = marketplace.getStats();
      if (opts.json) {
        output(stats, true);
      } else {
        console.log('Marketplace Stats:');
        console.log(`  Total Skills: ${stats.totalSkills}`);
        console.log(`  Categories: ${stats.totalCategories}`);
        console.log(`  Total Downloads: ${stats.totalDownloads}`);
        console.log(`  Average Rating: ${stats.averageRating}/5`);
        console.log(`  Last Updated: ${stats.lastUpdated}`);
      }
      break;
    }

    default:
      console.log('Zavorth Skill Marketplace');
      console.log('');
      console.log('Usage:');
      console.log('  zavorth marketplace list              List categories');
      console.log('  zavorth marketplace search <query>    Search skills');
      console.log('  zavorth marketplace install <id>      Install a skill');
      console.log('  zavorth marketplace info <id>         Show skill details');
      console.log('  zavorth marketplace rate <id> --rating <1-5>  Rate a skill');
      console.log('  zavorth marketplace stats             Show marketplace stats');
      console.log('');
      console.log('Options:');
      console.log('  --json            Output as JSON');
      console.log('  --category <cat>  Filter by category');
      console.log('  --sort <mode>     Sort: popular, recent, rating');
      console.log('  --limit <n>       Limit results');
      break;
  }
}

main();
