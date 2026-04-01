import axios from 'axios'
import { defineStore } from 'pinia'
import { z } from 'zod'
import {
  type ConfigData,
  type ConfigListItem,
  type ConfigOut,
  ConfigListItemSchema,
  ConfigOutSchema,
  emptyConfigData,
} from '@/types'

export const useConfigStore = defineStore('configs', {
  state: () => ({
    items: [] as ConfigListItem[],
    current: null as ConfigOut | null,
    loading: false,
    error: null as string | null,
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

    getGenerateUrl(id: string): string {
      return `${window.location.origin}/api/configs/${id}/generate`
    },

    getStatelessGenerateUrl(configUrl: string): string {
      return `${window.location.origin}/api/generate?url=${encodeURIComponent(configUrl)}`
    },

    async generate(data: ConfigData): Promise<object> {
      const res = await axios.post('/api/generate', data)
      return res.data
    },
  },
})
