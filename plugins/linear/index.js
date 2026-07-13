function register(ctx) {
  const logger = ctx.getLogger();

  function apiKey() {
    return String(process.env.LINEAR_API_KEY || '').trim();
  }

  async function linearGraphql(query, variables) {
    const key = apiKey();
    if (!key) {
      return { ok: false, reason: 'no_token' };
    }
    try {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: variables || {} }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        return { ok: false, reason: 'api_error', status: response.status };
      }
      const data = await response.json();
      if (data.errors && data.errors.length) {
        return {
          ok: false,
          reason: 'graphql_error',
          errors: data.errors,
        };
      }
      return { ok: true, data: data.data };
    } catch (error) {
      return {
        ok: false,
        reason: 'fetch_failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('linear.status', async () => {
    try {
      const present = Boolean(apiKey());
      return {
        output: {
          ok: present,
          tokenPresent: present,
          message: present
            ? 'LINEAR_API_KEY is present.'
            : 'LINEAR_API_KEY is not configured.',
          setup: setupTips(),
        },
      };
    } catch (error) {
      logger.warn('linear.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('linear.issues.list', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 10) || 10));
      if (!apiKey()) {
        return {
          output: {
            ok: false,
            issues: [],
            reason: 'no_token',
            setup: setupTips(),
          },
        };
      }
      const result = await linearGraphql(
        `query Issues($first: Int!) {
          issues(first: $first) {
            nodes { id identifier title url state { name } }
          }
        }`,
        { first: limit },
      );
      if (!result.ok) {
        return {
          output: {
            ok: false,
            issues: [],
            ...result,
            setup: setupTips(),
          },
        };
      }
      const issues = (result.data && result.data.issues && result.data.issues.nodes) || [];
      return {
        output: {
          ok: true,
          issues,
          count: issues.length,
        },
      };
    } catch (error) {
      logger.warn('linear.issues.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          issues: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('linear.issue.create', async ({ input }) => {
    try {
      const title = String((input && input.title) || '').trim();
      const description = String((input && (input.description || input.body)) || '').trim();
      if (!title) {
        return { output: { ok: false, reason: 'title is required' } };
      }

      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'network.external',
          `Create Linear issue: ${title}`,
        );
      }
      if (!approved) {
        return {
          output: {
            ok: false,
            reason: 'needs_approval',
            preview: { title, description },
            message: 'linear.issue.create requires approved===true.',
          },
        };
      }

      if (!apiKey()) {
        return {
          output: {
            ok: false,
            reason: 'no_token',
            setup: setupTips(),
          },
        };
      }

      // Resolve a team id soft (first team)
      const teams = await linearGraphql(
        `query { teams(first: 1) { nodes { id name } } }`,
      );
      if (!teams.ok) {
        return {
          output: {
            ok: false,
            ...teams,
            setup: setupTips(),
          },
        };
      }
      const teamId = teams.data
        && teams.data.teams
        && teams.data.teams.nodes
        && teams.data.teams.nodes[0]
        && teams.data.teams.nodes[0].id;
      if (!teamId) {
        return {
          output: {
            ok: false,
            reason: 'no_team',
            message: 'No Linear team available for issue create.',
            setup: setupTips(),
          },
        };
      }

      const created = await linearGraphql(
        `mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url }
          }
        }`,
        {
          input: {
            teamId,
            title,
            description: description || undefined,
          },
        },
      );
      if (!created.ok) {
        return {
          output: {
            ok: false,
            ...created,
            setup: setupTips(),
          },
        };
      }
      const payload = created.data && created.data.issueCreate;
      return {
        output: {
          ok: Boolean(payload && payload.success),
          issue: (payload && payload.issue) || null,
        },
      };
    } catch (error) {
      logger.warn('linear.issue.create failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });
}

function setupTips() {
  return [
    'Set LINEAR_API_KEY from https://linear.app/settings/api',
    'Issue create requires approved=true.',
    'Offline mode returns setup tips without network calls.',
  ];
}

module.exports = { register };
