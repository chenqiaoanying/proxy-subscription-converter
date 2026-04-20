import axios from 'axios'
import { defineStore } from 'pinia'
import { z } from 'zod'
import {
  type ConfigData,
  type ConfigListItem,
  type ConfigOut,
  type ProxyInfo,
  type SubscriptionUserInfo,
  type TargetFormat,
  ConfigListItemSchema,
  ConfigOutSchema,
  emptyConfigData,
} from '@/types'

export interface GenerateResult {
  format: TargetFormat
  body: string
  mediaType: string
  dropped: number
}

export const useConfigStore = defineStore('configs', {
  state: () => ({
    items: [] as ConfigListItem[],
    current: null as ConfigOut | null,
    loading: false,
    error: null as string | null,
    subscriptionPreviews: {} as Record<string, ProxyInfo[]>,
    previewLoading: {} as Record<string, boolean>,
    subscriptionUserInfos: {} as Record<string, SubscriptionUserInfo>,
  }),

  actions: {
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/configs')
        this.items = z.array(ConfigListItemSchema).parse(res.data)
      } catch (e) {
        this.error = String(e)
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string) {
      const res = await axios.get(`/api/configs/${id}`)
      this.current = ConfigOutSchema.parse(res.data)
      return this.current
    },

    async create(name: string, data: ConfigData = emptyConfigData()) {
      const res = await axios.post('/api/configs', { name, data })
      const created = ConfigOutSchema.parse(res.data)
      await this.fetchAll()
      return created
    },

    async update(id: string, name: string, data: ConfigData) {
      const res = await axios.put(`/api/configs/${id}`, { name, data })
      const updated = ConfigOutSchema.parse(res.data)
      this.current = updated
      const idx = this.items.findIndex((c) => c.id === id)
      if (idx >= 0) {
        this.items[idx] = { ...this.items[idx], name: updated.name, updated_at: updated.updated_at }
      }
      return updated
    },

    async remove(id: string) {
      await axios.delete(`/api/configs/${id}`)
      this.items = this.items.filter((c) => c.id !== id)
      if (this.current?.id === id) this.current = null
    },

    getGenerateUrl(id: string, format: TargetFormat): string {
      return `${window.location.origin}/api/configs/${id}/generate?format=${format}`
    },

    getStatelessGenerateUrl(configUrl: string, format: TargetFormat): string {
      return (
        `${window.location.origin}/api/generate` +
        `?url=${encodeURIComponent(configUrl)}&format=${format}`
      )
    },

    async generate(data: ConfigData, format: TargetFormat): Promise<GenerateResult> {
      const res = await axios.post(`/api/generate?format=${format}`, data, {
        responseType: 'text',
        transformResponse: (v: unknown) => v,
      })
      const mediaType = String(res.headers['content-type'] ?? '').split(';')[0].trim()
      const droppedHeader = res.headers['x-dropped-proxies']
      return {
        format,
        body: String(res.data ?? ''),
        mediaType,
        dropped: droppedHeader ? Number(droppedHeader) : 0,
      }
    },

    async previewSubscription(name: string, url: string, userAgent?: string | null) {
      this.previewLoading = { ...this.previewLoading, [name]: true }
      try {
        const res = await axios.post('/api/subscriptions/preview', {
          url,
          user_agent: userAgent ?? null,
        })
        const proxies: ProxyInfo[] = res.data.proxies
        const userinfo: SubscriptionUserInfo | null = res.data.userinfo ?? null
        this.subscriptionPreviews = { ...this.subscriptionPreviews, [name]: proxies }
        if (userinfo) {
          this.subscriptionUserInfos = { ...this.subscriptionUserInfos, [name]: userinfo }
        }
      } finally {
        this.previewLoading = { ...this.previewLoading, [name]: false }
      }
    },
  },
})
