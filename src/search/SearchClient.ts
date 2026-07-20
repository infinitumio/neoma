// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Main-thread RPC client for the index worker. Implements the SearchIndex
 * contract and additionally returns extracted NoteMeta from upserts, which
 * the vault store feeds into the link index.
 */
import type { NoteMeta, SearchFilters, SearchIndex, SearchResultItem } from '@/types'

interface Pending {
  resolve: (value: any) => void
  reject: (reason: Error) => void
}

export class SearchClient implements SearchIndex {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor() {
    this.worker = new Worker(new URL('../workers/indexWorker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<{ id: number; result?: any; error?: string }>) => {
      const { id, result, error } = event.data
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      if (error) pending.reject(new Error(error))
      else pending.resolve(result)
    }
  }

  private call<T>(op: string, payload?: unknown): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, op, payload })
    })
  }

  /** Upsert notes; resolves with the extracted metadata for each. */
  upsertWithMeta(
    items: Array<{ path: string; text: string; createdAt: number; modifiedAt: number }>,
  ): Promise<NoteMeta[]> {
    return this.call('upsert', { items })
  }

  async upsert(docs: Array<{ path: string; text: string; meta: NoteMeta }>): Promise<void> {
    await this.upsertWithMeta(
      docs.map((d) => ({
        path: d.path,
        text: d.text,
        createdAt: d.meta.createdAt,
        modifiedAt: d.meta.modifiedAt,
      })),
    )
  }

  async remove(path: string): Promise<void> {
    await this.call('remove', { path })
  }

  async rename(oldPath: string, newPath: string): Promise<NoteMeta[] | void> {
    return this.call('rename', { oldPath, newPath })
  }

  query(query: string, filters?: SearchFilters): Promise<SearchResultItem[]> {
    return this.call('query', { query, filters })
  }

  mentions(terms: string[], excludePath: string): Promise<SearchResultItem[]> {
    return this.call('mentions', { terms, excludePath })
  }

  contexts(items: Array<{ path: string; offset: number }>): Promise<string[]> {
    return this.call('contexts', { items })
  }

  async clear(): Promise<void> {
    await this.call('clear')
  }

  terminate(): void {
    this.worker.terminate()
    this.pending.forEach((p) => p.reject(new Error('Search worker terminated')))
    this.pending.clear()
  }
}
