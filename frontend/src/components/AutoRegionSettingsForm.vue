<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  subscriptionNames: string[]
}>()

const groupType = defineModel<'selector' | 'urltest'>('groupType', { required: true })
const subGroupType = defineModel<'selector' | 'urltest'>('subGroupType', { required: true })
const regionsMode = defineModel<'auto' | 'custom'>('regionsMode', { required: true })
const regionsList = defineModel<string[]>('regionsList', { required: true })
const othersTag = defineModel<string>('othersTag', { required: true })
const useEmoji = defineModel<boolean>('useEmoji', { required: true })
const regionMapEntries = defineModel<{ keyword: string; region: string }[]>('regionMapEntries', { required: true })
const showRegionMap = defineModel<boolean>('showRegionMap', { required: true })

const isCustomRegions = computed(() => regionsMode.value === 'custom')

function addEntry() { regionMapEntries.value.push({ keyword: '', region: '' }) }
function removeEntry(idx: number) { regionMapEntries.value.splice(idx, 1) }
</script>

<template>
  <el-divider>Auto Region Settings</el-divider>

  <el-form-item label="Parent type">
    <el-radio-group v-model="groupType">
      <el-radio value="selector">selector</el-radio>
      <el-radio value="urltest">urltest</el-radio>
    </el-radio-group>
  </el-form-item>

  <el-form-item label="Sub-group type">
    <el-radio-group v-model="subGroupType">
      <el-radio value="selector">selector</el-radio>
      <el-radio value="urltest">urltest</el-radio>
    </el-radio-group>
  </el-form-item>

  <el-form-item label="Regions">
    <div style="width: 100%">
      <el-radio-group v-model="regionsMode" style="margin-bottom: 8px">
        <el-radio value="auto">Auto (dynamic)</el-radio>
        <el-radio value="custom">Custom list</el-radio>
      </el-radio-group>
      <template v-if="isCustomRegions">
        <el-select
          v-model="regionsList"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="Type a region code and press Enter"
          style="width: 100%"
        />
        <el-text type="info" size="small">
          Groups follow this order. Unmatched proxies go to the "Others" group.
        </el-text>
      </template>
      <el-text v-else type="info" size="small">
        Groups are created from subscription content, sorted by proxy count.
      </el-text>
    </div>
  </el-form-item>

  <el-form-item label="Others tag">
    <el-input v-model="othersTag" placeholder="Others" />
    <el-text type="info" size="small">
      Substituted into <code>{region}</code> for the catch-all group.
    </el-text>
  </el-form-item>

  <el-form-item label="Emoji flags">
    <el-checkbox v-model="useEmoji">Use emoji flags (e.g. 🇭🇰 HK)</el-checkbox>
  </el-form-item>

  <el-form-item label="">
    <el-button size="small" link @click="showRegionMap = !showRegionMap">
      <el-icon><Setting /></el-icon>
      {{ showRegionMap ? 'Hide' : 'Show' }} keyword overrides
    </el-button>
  </el-form-item>

  <template v-if="showRegionMap">
    <el-form-item label="Keyword overrides">
      <div style="width: 100%">
        <div
          v-for="(entry, idx) in regionMapEntries"
          :key="idx"
          style="display: flex; gap: 8px; margin-bottom: 6px"
        >
          <el-input v-model="entry.keyword" placeholder="keyword" style="flex: 1" />
          <el-input v-model="entry.region" placeholder="region code" style="flex: 0 0 100px" />
          <el-button size="small" type="danger" @click="removeEntry(idx)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-button size="small" @click="addEntry">
          <el-icon><Plus /></el-icon>
          Add override
        </el-button>
        <el-text type="info" size="small" style="margin-left: 8px">
          Checked before the built-in keyword map.
        </el-text>
      </div>
    </el-form-item>
  </template>
</template>
