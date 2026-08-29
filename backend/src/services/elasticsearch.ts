import { Client } from '@elastic/elasticsearch';
import { config } from '../config';

const client = new Client({
  node: config.elasticsearchUrl,
});

const INDEX_NAME = 'emails';

export class ElasticsearchService {
  private static isConnected = false;

  /**
   * Initializes the Elasticsearch Index and Mappings if they do not exist.
   */
  static async init() {
    try {
      // Check connection
      const pingResult = await client.ping();
      if (!pingResult) {
        throw new Error('Elasticsearch ping failed');
      }
      
      this.isConnected = true;
      console.log('Elasticsearch is connected');

      const exists = await client.indices.exists({ index: INDEX_NAME });
      if (!exists) {
        await client.indices.create({
          index: INDEX_NAME,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`Elasticsearch index '${INDEX_NAME}' created`);
      }
    } catch (error) {
      this.isConnected = false;
      console.warn('Elasticsearch initialization failed. Search features may be unavailable until connection is established. Error:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Indexes or updates an email document.
   */
  static async indexEmail(email: {
    id: string;
    userId: string;
    sender: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt: Date | null;
    createdAt: Date;
  }) {
    if (!this.isConnected) {
      // Try re-initializing once on call
      await this.init();
      if (!this.isConnected) return;
    }

    try {
      await client.index({
        index: INDEX_NAME,
        id: email.id,
        body: {
          id: email.id,
          userId: email.userId,
          sender: email.sender,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          createdAt: email.createdAt.toISOString(),
        },
        refresh: true, // Refresh index immediately to make searchable in tests/UI
      });
    } catch (error) {
      console.error(`Failed to index email ${email.id} in Elasticsearch:`, error);
    }
  }

  /**
   * Performs full-text search across subject, body, recipient, and sender.
   */
  static async searchEmails(params: {
    userId: string;
    query: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ ids: string[]; total: number }> {
    if (!this.isConnected) {
      await this.init();
      if (!this.isConnected) {
        return { ids: [], total: 0 };
      }
    }

    const { userId, query, status, limit = 20, offset = 0 } = params;

    try {
      const mustQueries: any[] = [{ term: { userId } }];

      if (status) {
        mustQueries.push({ term: { status } });
      }

      if (query && query.trim() !== '') {
        mustQueries.push({
          multi_match: {
            query: query,
            fields: ['subject^2', 'body', 'recipient', 'sender'],
            fuzziness: 'AUTO',
          },
        });
      }

      const response = await client.search({
        index: INDEX_NAME,
        from: offset,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustQueries,
            },
          },
          sort: [
            { createdAt: { order: 'desc' } },
          ],
        },
      });

      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : (response.hits.total as any)?.value || 0;

      const ids = response.hits.hits.map((hit: any) => hit._source.id);

      return { ids, total };
    } catch (error) {
      console.error('Elasticsearch search operation failed:', error);
      return { ids: [], total: 0 };
    }
  }
}
