import axios from 'axios'
import { defineStore } from 'pinia'
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string().uuid(),
  github_id: z.number().int(),
  login: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
})

export type User = z.infer<typeof UserSchema>

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    initialized: false,
    loading: false,
  }),

  getters: {
    isLoggedIn: (state): boolean => state.user !== null,
  },

  actions: {
    async fetchMe(): Promise<User | null> {
      this.loading = true
      try {
        const res = await axios.get('/api/auth/me', { withCredentials: true })
        this.user = UserSchema.parse(res.data)
        return this.user
      } catch {
        this.user = null
        return null
      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    async ensureInitialized(): Promise<void> {
      if (!this.initialized) {
        await this.fetchMe()
      }
    },

    loginUrl(redirectAfter?: string): string {
      const base = '/api/auth/login'
      if (!redirectAfter) return base
      return `${base}?next=${encodeURIComponent(redirectAfter)}`
    },

    async logout(): Promise<void> {
      try {
        await axios.post('/api/auth/logout', null, { withCredentials: true })
      } finally {
        this.user = null
      }
    },
  },
})
