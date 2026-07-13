function register(ctx) {
  const logger = ctx.getLogger();
  const NOTION_VERSION = '2022-06-28';

  function apiKey() {
    return String(process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || '').trim();
  }

  async function notionFetch(pathname, options) {
    const key = apiKey();
    if (!key) {
      return { ok: false, reason: 'no_token' };
    }
    try {
      const response = await fetch(`https://api.notion.com/v1${pathname}`, {
        method: (options && options.method) || 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...((options && options.headers) || {}),
        },
        body: options && options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          detail = '';
        }
        return {
          ok: false,
          reason: 'api_error',
          status: response.status,
          detail: detail.slice(0, 400),
        };
      }
      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        reason: 'fetch_failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('notion.status', async () => {
    try {
      const present = Boolean(apiKey());
      return {
        output: {
          ok: present,
          tokenPresent: present,
          message: present
            ? 'NOTION_API_KEY is present.'
            : 'NOTION_API_KEY is not configured.',
          setup: setupTips(),
        },
      };
    } catch (error) {
      logger.warn('notion.status failed', {
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

  ctx.bindCapability('notion.search', async ({ input }) => {
    try {
      const query = String((input && (input.query || input.q || input.text)) || '').trim();
      if (!query) {
        return { output: { ok: false, reason: 'query is required', results: [] } };
      }
      if (!apiKey()) {
        return {
          output: {
            ok: false,
            results: [],
            reason: 'no_token',
            setup: setupTips(),
          },
        };
      }
      const result = await notionFetch('/search', {
        method: 'POST',
        body: { query, page_size: 10 },
      });
      if (!result.ok) {
        return {
          output: {
            ok: false,
            results: [],
            ...result,
            setup: setupTips(),
          },
        };
      }
      const results = Array.isArray(result.data && result.data.results)
        ? result.data.results
        : [];
      return {
        output: {
          ok: true,
          query,
          results,
          count: results.length,
        },
      };
    } catch (error) {
      logger.warn('notion.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          results: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('notion.page.create', async ({ input }) => {
    try {
      const title = String((input && input.title) || '').trim();
      const content = String((input && (input.content || input.body || input.text)) || '').trim();
      const parentPageId = String(
        (input && (input.parentPageId || input.parent || input.pageId))
        || process.env.NOTION_PARENT_PAGE_ID
        || '',
      ).trim();

      if (!title) {
        return { output: { ok: false, reason: 'title is required' } };
      }

      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'network.external',
          `Create Notion page: ${title}`,
        );
      }
      if (!approved) {
        return {
          output: {
            ok: false,
            reason: 'needs_approval',
            preview: { title, content, parentPageId: parentPageId || null },
            message: 'notion.page.create requires approved===true.',
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

      if (!parentPageId) {
        return {
          output: {
            ok: false,
            reason: 'parent_required',
            message: 'Provide parentPageId or set NOTION_PARENT_PAGE_ID.',
            setup: setupTips(),
          },
        };
      }

      const children = content
        ? [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: content.slice(0, 1900) } }],
          },
        }]
        : [];

      const result = await notionFetch('/pages', {
        method: 'POST',
        body: {
          parent: { page_id: parentPageId },
          properties: {
            title: {
              title: [{ type: 'text', text: { content: title } }],
            },
          },
          children,
        },
      });

      if (!result.ok) {
        return {
          output: {
            ok: false,
            ...result,
            setup: setupTips(),
          },
        };
      }

      return {
        output: {
          ok: true,
          page: {
            id: result.data && result.data.id,
            url: result.data && result.data.url,
          },
        },
      };
    } catch (error) {
      logger.warn('notion.page.create failed', {
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
    'Set NOTION_API_KEY (internal integration token).',
    'Share target pages/databases with the integration.',
    'Page create needs parentPageId or NOTION_PARENT_PAGE_ID and approved=true.',
  ];
}

module.exports = { register };
